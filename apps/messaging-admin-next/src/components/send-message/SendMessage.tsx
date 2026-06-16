"use client"
import { SendMessageProvider } from "./SendMessageContext"
import { SendMessageWizard } from "./SendMessageWizard"

const SendMessage = () => {
  return (
    <SendMessageProvider>
      <SendMessageWizard />
    </SendMessageProvider>
  )
}

export { SendMessage }
