import {
  Children,
  isValidElement,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from "react"
export function Case(props: PropsWithChildren & { when: string }) {
  return props.children
}

export function Switch(props: PropsWithChildren & { value?: string }) {
  let match: ReactNode | null = null

  Children.forEach(props.children, (child: ReactNode) => {
    if (match) {
      return
    }
    if (!isValidElement(child)) {
      return
    }

    const element = child as ReactElement<PropsWithChildren & { when: string }>

    if (element.type !== Case) {
      return
    }

    if (element.props.when === props.value) {
      match = element.props.children
    }
  })

  return match
}
