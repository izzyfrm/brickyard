import { Component, type ReactNode } from 'react'
import { Button } from './ui/Button'

/** A render crash in the chat must not take the whole window down. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-10 text-center">
        <p className="text-[15px] font-medium">This view hit an error</p>
        <p className="selectable max-w-[460px] font-mono text-xs leading-relaxed text-fg3">{this.state.error.message}</p>
        <Button className="mt-3" onClick={() => this.setState({ error: null })}>
          Try again
        </Button>
      </div>
    )
  }
}
