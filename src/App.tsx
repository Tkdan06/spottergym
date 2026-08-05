import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { GuestOnly, ProtectedRoute } from './components/ProtectedRoute'
import { AppProvider } from './context/AppContext'
import { AdminHubPage } from './pages/AdminHubPage'
import { AdminPlayersPage } from './pages/AdminPlayersPage'
import { AdminTicketsPage } from './pages/AdminTicketsPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { ChatPage } from './pages/ChatPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { GymDetailPage } from './pages/GymDetailPage'
import { HomePage } from './pages/HomePage'
import { LikedPage } from './pages/LikedPage'
import { LoginPage } from './pages/LoginPage'
import { MessagesPage } from './pages/MessagesPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { SettingsPage } from './pages/SettingsPage'
import { TermsPage } from './pages/TermsPage'
import { UserProfilePage } from './pages/UserProfilePage'
import { WelcomePage } from './pages/WelcomePage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route path="/terms" element={<TermsPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="discover" element={<DiscoverPage />} />
              <Route path="gym/:gymId" element={<GymDetailPage />} />
              <Route path="user/:userId" element={<UserProfilePage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="messages/:conversationId" element={<ChatPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="likes" element={<LikedPage mode="received" />} />
              <Route path="likes/sent" element={<LikedPage mode="sent" />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="feedback/:ticketId" element={<FeedbackPage />} />
              <Route path="admin" element={<AdminHubPage />} />
              <Route path="admin/players" element={<AdminPlayersPage />} />
              <Route path="admin/tickets" element={<AdminTicketsPage />} />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
