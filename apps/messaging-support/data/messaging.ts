import { withSpan } from "@ogcio/o11y-sdk-node"
import dayjs from "dayjs"
import {
  buildAppliedFilter,
  decodeBooleanParam,
  decodeDateParam,
  decodeListParam,
  getMessageEventDisplayLabel,
  isDisplayableMessageEvent,
  MessageEventStatusKey,
} from "@/utils/appliedFilter"
import { serverMessagingFilterKeySelectOptions } from "@/utils/appliedFilter.server"
import type {
  AppliedFilter,
  MessageEventStatus,
} from "@/utils/appliedFilter.types"
import { logger } from "./logger"
import { messagePool } from "./pg"
import type {
  MessageQueryRow,
  NextSearchParams,
  Result,
  TableMessage,
  WhereClause,
} from "./types"
import { failure, GENERIC_USER_ERROR, isError, success } from "./utils"

function buildDateWhere(
  filters: AppliedFilter[],
  startValueIndex = 1,
): Result<WhereClause> {
  try {
    const fragments: string[] = []
    const values: string[] = []

    let paramIndex = startValueIndex
    for (const filter of filters) {
      if (filter.meta.type !== "date") continue

      const column = filter.key
      const { dateOption, from, to } = filter.meta

      if (dateOption === "between" && from && to) {
        fragments.push(
          `(${column} >= $${paramIndex++}::date AND ${column} <= $${paramIndex++}::date)`,
        )
        values.push(from, to)
      }

      if (dateOption === "from" && from) {
        fragments.push(`(${column} >= $${paramIndex++})`)
        values.push(from)
      }

      if (dateOption === "to" && to) {
        fragments.push(`(${column} <= $${paramIndex++})`)
        values.push(to)
      }
    }

    if (fragments.length === 0) {
      return success({ sql: "", values, currentIndex: startValueIndex })
    }

    const sql = `(${fragments.join(" OR ")})`
    return success({ sql, values, currentIndex: paramIndex })
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

function buildListWhere(
  filters: AppliedFilter[],
  startValueIndex = 1,
): Result<WhereClause> {
  try {
    const sqlFragments: string[] = []
    const values: string[] = []

    let paramIndex = startValueIndex
    let nextValueIndex = startValueIndex
    for (const filter of filters) {
      if (filter.meta.type !== "list") continue

      const requiredStatuses: MessageEventStatus[] = []
      if (filter.meta.successful) {
        requiredStatuses.push(MessageEventStatusKey.SUCCESSFUL)
      }
      if (filter.meta.failed) {
        requiredStatuses.push(MessageEventStatusKey.FAILED)
      }
      if (filter.key === "status_type_ie") {
        if (!requiredStatuses.length) {
          continue
        }

        for (const status of requiredStatuses) {
          sqlFragments.push(
            `(exists(select 1 from JSONB_ARRAY_ELEMENTS(b.status) AS s_obj(item) where s_obj.item->>'type' = $${nextValueIndex++} AND s_obj.item->>'status' = $${nextValueIndex++}))`,
          )
          values.push(filter.meta.selectedValue, status)
        }

        continue
      }

      const column = filter.key
      const value = filter.meta.selectedValue

      let fragment = `${column} = $${paramIndex++}`
      if (filter.meta.successful && !filter.meta.failed) {
        fragment += " and s.event_status='successful'"
      }
      if (filter.meta.failed && !filter.meta.successful) {
        fragment += " and s.event_status='failed'"
      }
      sqlFragments.push(fragment)
      values.push(value)
    }

    if (sqlFragments.length === 0) {
      return success({ sql: "", values: [], currentIndex: startValueIndex })
    }

    // OR all list filters together
    const sql = `(${sqlFragments.join(" OR ")})`
    return success({ sql, values, currentIndex: paramIndex })
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

function buildBooleanWhere(
  filters: AppliedFilter[],
  startValueIndex = 1,
): Result<WhereClause> {
  try {
    const sqlFragments: string[] = []
    let nextValueIndex = startValueIndex
    const values: string[] = []

    for (const filter of filters) {
      if (filter.meta.type !== "boolean") {
        continue
      }
      const identifier = filter.key

      const requiredStatuses: MessageEventStatus[] = []
      if (filter.meta.successful) {
        requiredStatuses.push(MessageEventStatusKey.SUCCESSFUL)
      }
      if (filter.meta.failed) {
        requiredStatuses.push(MessageEventStatusKey.FAILED)
      }

      if (identifier === "status_type_email") {
        if (!requiredStatuses.length) {
          sqlFragments.push(
            `(NOT EXISTS ( SELECT 1 FROM JSONB_ARRAY_ELEMENTS(b.status) AS s_obj(item) where s_obj.item->>'type' = 'email_delivery'))`,
          )
        } else {
          for (const status of requiredStatuses) {
            sqlFragments.push(`
                    (exists 
                        ( 
                            select 1 from JSONB_ARRAY_ELEMENTS(b.status) AS s_obj(item) 
                            where s_obj.item->>'type' = 'email_delivery' 
                            AND s_obj.item->>'status' = $${nextValueIndex}
                        )
                    )`)
            nextValueIndex++
            values.push(status)
          }
        }
      } else {
        for (const status of requiredStatuses) {
          const sqlBoolValue = (status === MessageEventStatusKey.SUCCESSFUL)
            .toString()
            .toUpperCase()
          sqlFragments.push(`${nextValueIndex++} = ${nextValueIndex++}`)
          values.push(identifier, sqlBoolValue)
        }
      }
    }

    if (!sqlFragments.length) {
      return success({ sql: "", values: [], currentIndex: nextValueIndex })
    }

    return success({
      sql: `(${sqlFragments.join(" OR ")})`,
      values,
      currentIndex: nextValueIndex,
    })
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

async function buildWhere(
  searchParams: NextSearchParams,
): Promise<Result<WhereClause>> {
  const urlSearchParamStates: AppliedFilter[] = []

  try {
    for (const key of Object.keys(searchParams)) {
      const option = serverMessagingFilterKeySelectOptions.find(
        (o) => o.value === key,
      )
      if (!option) {
        continue
      }

      const values = Array.isArray(searchParams[key])
        ? searchParams[key]
        : [searchParams[key]]
      switch (option.type) {
        case "date":
          urlSearchParamStates.push(
            ...(values
              .map((val) =>
                buildAppliedFilter({
                  key: option.value,
                  keylabel: "",
                  meta: decodeDateParam(val),
                }),
              )
              .filter(Boolean) as AppliedFilter[]),
          )
          break
        case "list":
          urlSearchParamStates.push(
            ...values
              .map((val) =>
                buildAppliedFilter({
                  key: option.value,
                  keylabel: "",
                  meta: decodeListParam(val),
                }),
              )
              .filter(Boolean),
          )
          break
        case "boolean":
          urlSearchParamStates.push(
            ...values.map((val) =>
              buildAppliedFilter({
                key: option.value,
                keylabel: "",
                meta: decodeBooleanParam(val),
              }),
            ),
          )
          break
      }
    }
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }

  const dateQueriesResult = buildDateWhere(urlSearchParamStates, 2)
  if (!dateQueriesResult.success) {
    return dateQueriesResult
  }

  const dateQueries = dateQueriesResult.value

  const listQueriesResult = buildListWhere(
    urlSearchParamStates,
    dateQueries.currentIndex ?? 2,
  )

  if (!listQueriesResult.success) {
    return listQueriesResult
  }
  const listQueries = listQueriesResult.value

  const boolQueriesResult = buildBooleanWhere(
    urlSearchParamStates,
    listQueries.currentIndex ?? 2,
  )

  if (!boolQueriesResult.success) {
    return boolQueriesResult
  }

  const boolQueries = boolQueriesResult.value

  const combinedWhere = [dateQueries.sql, listQueries.sql, boolQueries.sql]
    .filter(Boolean)
    .join(" AND ")

  const combinesValues = [
    ...dateQueries.values,
    ...listQueries.values,
    ...boolQueries.values,
  ]

  return success({ sql: combinedWhere, values: combinesValues })
}

async function queryMessages(
  profileIds: string[],
  whereClause: WhereClause,
): Promise<Result<MessageQueryRow[]>> {
  try {
    const messageQueryResult = await messagePool.query<MessageQueryRow>(
      `
            with a as (
                select * from messages where user_id = ANY($1)
            ), b as (
                select
                    a.id,
                    a.scheduled_at,
                    a.subject,
                    a.organisation_id,
                    JSONB_AGG(JSONB_BUILD_OBJECT('type',l.event_type, 'status',l.event_status)) as status
                from a
                join messaging_event_logs l on l.message_id = a.id
                group by a.id, a.scheduled_at, a.subject, a.organisation_id
            )
            select * from b
            WHERE ${whereClause.sql || "TRUE"}
            order by scheduled_at desc 
            limit 20;
            `,
      [profileIds.sort(), ...whereClause.values],
    )

    return success(messageQueryResult.rows)
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

export async function getMessages(
  profileIds: string[],
  nextSearchParams: NextSearchParams,
): Promise<Result<TableMessage[]>> {
  return withSpan({
    spanName: "getMessages",
    fn: async (span) => {
      const whereClauseResult = await buildWhere(nextSearchParams)

      if (!whereClauseResult.success) {
        logger.error(whereClauseResult.error)
        span.recordException(whereClauseResult.error)
        return whereClauseResult
      }

      const whereClause = whereClauseResult.value

      const messageRowsResult = await queryMessages(profileIds, whereClause)
      if (!messageRowsResult.success) {
        logger.error(messageRowsResult.error)
        span.recordException(messageRowsResult.error)
        return messageRowsResult
      }

      const messageRows = messageRowsResult.value

      try {
        const tableRows: TableMessage[] = []
        for (const row of messageRows) {
          const email = row.status.find((s) => s.type === "email_delivery")
          const event = row.status.find((s) =>
            isDisplayableMessageEvent(s.type),
          )
          tableRows.push({
            id: row.id,
            emailEventType: email
              ? getMessageEventDisplayLabel(email.type, email.status)
              : "",
            emailEventStatus: email?.status,
            messagingEventType: event
              ? getMessageEventDisplayLabel(event.type, event.status)
              : "",
            messagingEventStatus: event?.status,
            orgId: row.organisation_id,
            scheduledAt: dayjs(row.scheduled_at).format("DD MMM YYYY, HH:mm"),
            subject: row.subject,
          })
        }

        return success(tableRows)
      } catch (err) {
        logger.error(err)
        const error = isError(err) ? err : new Error("unknown error")
        span.recordException(error)
        return failure(err, GENERIC_USER_ERROR)
      }
    },
  })
}
