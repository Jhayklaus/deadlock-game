import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { useGameStore } from './lib/store'
import { parseDeepLink, resolveDeepLink, syncAddressBar } from './lib/deepLink'

/**
 * Follow an invite link before the first render.
 *
 * Order matters here. The store rehydrates from localStorage synchronously on
 * import, and App's init effect auto-rejoins whatever `hostId` it finds there.
 * Resolving the link first means a stale session is already cleared by the
 * time that effect runs, so the link wins instead of losing a race.
 */
function followInviteLink() {
  const store = useGameStore.getState()
  const intent = resolveDeepLink(parseDeepLink(), {
    roomCode: store.roomCode,
    hostId: store.hostId,
    phase: store.phase,
  })

  switch (intent.kind) {
    case 'join_room':
      // Drop the old session, then hand the code to the pre-join screen. The
      // player still picks a name — we only skip the mode choice for them.
      store.resetSession()
      useGameStore.getState().setPendingJoinCode(intent.room)
      useGameStore.getState().setGameMode(intent.mode)
      useGameStore.getState().setSelectedMode(intent.mode)
      useGameStore.getState().setUiScreen('pre_join')
      break

    case 'open_mode':
      store.setGameMode(intent.mode)
      store.setSelectedMode(intent.mode)
      store.setUiScreen('pre_join')
      break

    case 'resume':
      // Leave the stored session alone, but put the URL back in a shareable
      // shape — someone may have landed here from a bare "/" refresh.
      syncAddressBar(store.hostId ? store.gameMode : null, store.roomCode)
      break
  }
}

followInviteLink()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
