import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LiveRoom from './pages/LiveRoom'
import AIAgentChat from './pages/AIAgentChat'

// Placeholders for Phase 3
const Feed = () => <div className="p-8 text-center text-muted-foreground">Feed Page (Coming Soon)</div>
const Community = () => <div className="p-8 text-center text-muted-foreground">Community Page (Coming Soon)</div>
const Events = () => <div className="p-8 text-center text-muted-foreground">Events Page (Coming Soon)</div>
const Messages = () => <div className="p-8 text-center text-muted-foreground">Messages Page (Coming Soon)</div>

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Feed />} />
        <Route path="community" element={<Community />} />
        <Route path="events" element={<Events />} />
        <Route path="live" element={<LiveRoom />} />
        <Route path="messages" element={<Messages />} />
        <Route path="ai" element={<AIAgentChat />} />
        <Route path="*" element={<div className="p-8 text-center">404 Not Found</div>} />
      </Route>
    </Routes>
  )
}

export default App
