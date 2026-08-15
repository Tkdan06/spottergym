import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { GuestOnly, ProtectedRoute } from './components/ProtectedRoute'
import { AppProvider } from './context/AppContext'
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage'
import { AdminGeographyPage } from './pages/AdminGeographyPage'
import { AdminHubPage } from './pages/AdminHubPage'
import { AdminLandingPage } from './pages/AdminLandingPage'
import { AdminPasswordResetsPage } from './pages/AdminPasswordResetsPage'
import { AdminPlayersPage } from './pages/AdminPlayersPage'
import { AdminStoragePage } from './pages/AdminStoragePage'
import { AdminTicketsPage } from './pages/AdminTicketsPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { BrandMotionLabPage } from './pages/BrandMotionLabPage'
import { ChatPage } from './pages/ChatPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { GymDetailPage } from './pages/GymDetailPage'
import { HomePage } from './pages/HomePage'
import { InstallGuidePage } from './pages/InstallGuidePage'
import { LandingCoachesPage } from './pages/LandingCoachesPage'
import { LandingPage } from './pages/LandingPage'
import { LikedPage } from './pages/LikedPage'
import { LoginPage } from './pages/LoginPage'
import { MessagesPage } from './pages/MessagesPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SettingsPage } from './pages/SettingsPage'
import { TermsPage } from './pages/TermsPage'
import { UiKitPage } from './pages/UiKitPage'
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
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* Ad landings — public even if logged in (preview + cold traffic) */}
          <Route path="/lp" element={<LandingPage />} />
          <Route path="/lp-coaches" element={<LandingCoachesPage />} />
          {/* Motion sandbox — letter intro preview */}
          <Route path="/brand-lab" element={<BrandMotionLabPage />} />

          <Route path="/terms" element={<TermsPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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
              <Route path="admin/analytics" element={<AdminAnalyticsPage />} />
              <Route path="admin/geography" element={<AdminGeographyPage />} />
              <Route path="admin/storage" element={<AdminStoragePage />} />
              <Route path="admin/password-resets" element={<AdminPasswordResetsPage />} />
              <Route path="admin/landing" element={<AdminLandingPage />} />
              <Route path="admin/tickets" element={<AdminTicketsPage />} />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="admin/ui" element={<UiKitPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="install" element={<InstallGuidePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
