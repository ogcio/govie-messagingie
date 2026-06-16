import dayjs from "dayjs"
import tz from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import { DUBLIN_TIMEZONE } from "@/types/shared"

export const defaultFormGap = 10

dayjs.extend(utc)
dayjs.extend(tz)

export function toIrishTime(ISO8601: string) {
  return dayjs(ISO8601).tz(DUBLIN_TIMEZONE)
}

export function formatDate(date: string, format = "DD-MM-YYYY") {
  return dayjs(date).tz(DUBLIN_TIMEZONE).format(format)
}

export function formatTime(date: string) {
  return dayjs(date).tz(DUBLIN_TIMEZONE).format("HH:mm:ss")
}

export function today() {
  return dayjs().tz(DUBLIN_TIMEZONE).format("YYYY-MM-DD")
}

export function daysAgo(days: number) {
  return dayjs().subtract(days, "day").tz(DUBLIN_TIMEZONE).format("YYYY-MM-DD")
}

export function oneYearAgo() {
  return dayjs().subtract(1, "year").tz(DUBLIN_TIMEZONE).format("YYYY-MM-DD")
}

export function daysFromNow(days: number) {
  return dayjs().add(days, "day").tz(DUBLIN_TIMEZONE).format("YYYY-MM-DD")
}

export function buildSchedule(...args: string[]): string {
  if (args.length === 2) {
    return dayjs(`${args[0]} ${args[1]}`).tz(DUBLIN_TIMEZONE).format()
  }
  return dayjs().tz(DUBLIN_TIMEZONE).format()
}
