import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LiveRoom from './pages/LiveRoom'
import AIAgentChat from './pages/AIAgentChat'
import Feed from './pages/Feed'
import Community from './pages/Community'
import Messages from './pages/Messages'
import Events from './pages/Events'
import Directory from './pages/Directory'
import Courses from './pages/Courses'
import Profile from './pages/Profile'
import Audience from './pages/Audience'

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
        <Route path="directory" element={<Directory />} />
        <Route path="courses" element={<Courses />} />
        <Route path="profile/:id" element={<Profile />} />
        <Route path="audience" element={<Audience />} />
        <Route path="*" element={<div className="p-8 text-center">404 Not Found</div>} />
      </Route>
    </Routes>
  )
}

export default App
