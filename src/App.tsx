import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { GuestOnly, ProtectedRoute } from './components/ProtectedRoute'
import { AppProvider } from './context/AppContext'
import { MomentProvider } from './components/MomentFX'
import { ActivityPage } from './pages/ActivityPage'
import { WorkoutEditorPage } from './pages/WorkoutEditorPage'
import { WorkoutsPage } from './pages/WorkoutsPage'
import { WorkoutsProgressPage } from './pages/WorkoutsProgressPage'
import { AdminBroadcastsPage } from './pages/AdminBroadcastsPage'
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage'
import { AdminGeographyPage } from './pages/AdminGeographyPage'
import { AdminHubPage } from './pages/AdminHubPage'
import { AdminLandingPage } from './pages/AdminLandingPage'
import { AdminPasswordResetsPage } from './pages/AdminPasswordResetsPage'
import { AdminPlayersPage } from './pages/AdminPlayersPage'
import { AdminReferralsPage } from './pages/AdminReferralsPage'
import { AdminStoragePage } from './pages/AdminStoragePage'
import { AdminTicketsPage } from './pages/AdminTicketsPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { ChatPage } from './pages/ChatPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { GymDetailPage } from './pages/GymDetailPage'
import { HomePage } from './pages/HomePage'
import { InstallGuidePage } from './pages/InstallGuidePage'
import { InviteCirclePage } from './pages/InviteCirclePage'
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
      <MomentProvider>
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
              <Route path="invite" element={<InviteCirclePage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="workouts" element={<WorkoutsPage />} />
              <Route path="workouts/progress" element={<WorkoutsProgressPage />} />
              <Route path="workouts/new" element={<WorkoutEditorPage />} />
              <Route path="workouts/:id/edit" element={<WorkoutEditorPage />} />
              <Route path="workouts/:id" element={<WorkoutEditorPage />} />
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
              <Route path="admin/referrals" element={<AdminReferralsPage />} />
              <Route path="admin/landing" element={<AdminLandingPage />} />
              <Route path="admin/broadcasts" element={<AdminBroadcastsPage />} />
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
      </MomentProvider>
    </AppProvider>
  )
}
