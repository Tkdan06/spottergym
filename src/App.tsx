import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { InviteCapture } from './components/InviteCapture'
import { NormalizePathname } from './components/NormalizePathname'
import { PublicTrafficCapture } from './components/PublicTrafficCapture'
import { ScrollToTop } from './components/ScrollToTop'
import { SeoHead } from './components/SeoHead'
import { SoftLoader } from './components/SoftLoader'
import { GuestOnly, ProtectedRoute } from './components/ProtectedRoute'
import { AppProvider } from './context/AppContext'
import { MomentProvider } from './components/MomentFX'
import { ActivityPage } from './pages/ActivityPage'
import { WorkoutEditorPage } from './pages/WorkoutEditorPage'
import { WorkoutsPage } from './pages/WorkoutsPage'
import { WorkoutsProgressPage } from './pages/WorkoutsProgressPage'
import { ChatPage } from './pages/ChatPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { GuideArticlePage, GuideIndexPage } from './pages/GuidePage'
import { WorkoutsGuideArticlePage, WorkoutsGuideHubPage } from './pages/WorkoutsGuidePage'
import { GymDetailPage } from './pages/GymDetailPage'
import { HomePage } from './pages/HomePage'
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
import { SettingsPage } from './pages/SettingsPage'
import { TermsPage } from './pages/TermsPage'
import { UserProfilePage } from './pages/UserProfilePage'
import { WelcomePage } from './pages/WelcomePage'

function lazyNamed<T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) {
  return lazy(async () => {
    const mod = await loader()
    return { default: mod[name] as ComponentType }
  })
}

const WorkoutsCoachPage = lazyNamed(() => import('./pages/WorkoutsCoachPage'), 'WorkoutsCoachPage')
const AdminBroadcastsPage = lazyNamed(() => import('./pages/AdminBroadcastsPage'), 'AdminBroadcastsPage')
const AdminAnalyticsPage = lazyNamed(() => import('./pages/AdminAnalyticsPage'), 'AdminAnalyticsPage')
const AdminGeographyPage = lazyNamed(() => import('./pages/AdminGeographyPage'), 'AdminGeographyPage')
const AdminHubPage = lazyNamed(() => import('./pages/AdminHubPage'), 'AdminHubPage')
const AdminOverviewPage = lazyNamed(() => import('./pages/AdminOverviewPage'), 'AdminOverviewPage')
const AdminProductPage = lazyNamed(() => import('./pages/AdminProductPage'), 'AdminProductPage')
const AdminCohortsPage = lazyNamed(() => import('./pages/AdminCohortsPage'), 'AdminCohortsPage')
const AdminGrowthPage = lazyNamed(() => import('./pages/AdminGrowthPage'), 'AdminGrowthPage')
const AdminGymsPage = lazyNamed(() => import('./pages/AdminGymsPage'), 'AdminGymsPage')
const AdminTimelinePage = lazyNamed(() => import('./pages/AdminTimelinePage'), 'AdminTimelinePage')
const AdminLandingPage = lazyNamed(() => import('./pages/AdminLandingPage'), 'AdminLandingPage')
const AdminOpsPage = lazyNamed(() => import('./pages/AdminOpsPage'), 'AdminOpsPage')
const AdminPasswordResetsPage = lazyNamed(
  () => import('./pages/AdminPasswordResetsPage'),
  'AdminPasswordResetsPage',
)
const AdminPlayersPage = lazyNamed(() => import('./pages/AdminPlayersPage'), 'AdminPlayersPage')
const AdminReferralsPage = lazyNamed(() => import('./pages/AdminReferralsPage'), 'AdminReferralsPage')
const AdminStoragePage = lazyNamed(() => import('./pages/AdminStoragePage'), 'AdminStoragePage')
const AdminTicketsPage = lazyNamed(() => import('./pages/AdminTicketsPage'), 'AdminTicketsPage')
const AdminUsersPage = lazyNamed(() => import('./pages/AdminUsersPage'), 'AdminUsersPage')
const FeedbackPage = lazyNamed(() => import('./pages/FeedbackPage'), 'FeedbackPage')
const ForgotPasswordPage = lazyNamed(() => import('./pages/ForgotPasswordPage'), 'ForgotPasswordPage')
const InstallGuidePage = lazyNamed(() => import('./pages/InstallGuidePage'), 'InstallGuidePage')
const InviteCirclePage = lazyNamed(() => import('./pages/InviteCirclePage'), 'InviteCirclePage')
const ResetPasswordPage = lazyNamed(() => import('./pages/ResetPasswordPage'), 'ResetPasswordPage')
const UiKitPage = lazyNamed(() => import('./pages/UiKitPage'), 'UiKitPage')

function LazyFallback() {
  return (
    <main className="page">
      <SoftLoader label="Загружаем…" />
    </main>
  )
}

function AppGuideRedirect() {
  const { slug } = useParams()
  return <Navigate to={slug ? `/guide/${slug}` : '/guide'} replace />
}

export default function App() {
  return (
    <AppProvider>
      <MomentProvider>
      <BrowserRouter>
        <NormalizePathname />
        <ScrollToTop />
        <InviteCapture />
        <SeoHead />
        <PublicTrafficCapture />
        <Suspense fallback={<LazyFallback />}>
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
          <Route path="/guide" element={<GuideIndexPage />} />
          <Route path="/guide/workouts" element={<WorkoutsGuideHubPage />} />
          <Route path="/guide/workouts/:article" element={<WorkoutsGuideArticlePage />} />
          <Route path="/guide/partner-po-trenirovkam" element={<Navigate to="/guide/workouts" replace />} />
          <Route path="/guide/:slug" element={<GuideArticlePage />} />
          <Route path="/guide/:slug/*" element={<GuideArticlePage />} />

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
              <Route path="workouts/coach" element={<WorkoutsCoachPage />} />
              <Route path="workouts/new" element={<WorkoutEditorPage />} />
              <Route path="workouts/:id/edit" element={<WorkoutEditorPage />} />
              <Route path="workouts/:id" element={<WorkoutEditorPage />} />
              <Route path="likes" element={<LikedPage mode="received" />} />
              <Route path="likes/sent" element={<LikedPage mode="sent" />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="feedback/:ticketId" element={<FeedbackPage />} />
              <Route path="admin" element={<AdminHubPage />} />
              <Route path="admin/overview" element={<AdminOverviewPage />} />
              <Route path="admin/product" element={<Navigate to="/app/admin/product/funnels" replace />} />
              <Route path="admin/product/:section" element={<AdminProductPage />} />
              <Route path="admin/cohorts" element={<AdminCohortsPage />} />
              <Route path="admin/growth" element={<Navigate to="/app/admin/growth/acquisition" replace />} />
              <Route path="admin/growth/:section" element={<AdminGrowthPage />} />
              <Route path="admin/gyms" element={<AdminGymsPage />} />
              <Route path="admin/timeline" element={<AdminTimelinePage />} />
              <Route path="admin/players" element={<AdminPlayersPage />} />
              <Route path="admin/analytics" element={<AdminAnalyticsPage />} />
              <Route path="admin/geography" element={<AdminGeographyPage />} />
              <Route path="admin/storage" element={<AdminStoragePage />} />
              <Route path="admin/password-resets" element={<AdminPasswordResetsPage />} />
              <Route path="admin/referrals" element={<AdminReferralsPage />} />
              <Route path="admin/landing" element={<AdminLandingPage />} />
              <Route path="admin/ops" element={<AdminOpsPage />} />
              <Route path="admin/broadcasts" element={<AdminBroadcastsPage />} />
              <Route path="admin/tickets" element={<AdminTicketsPage />} />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="admin/ui" element={<UiKitPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="install" element={<InstallGuidePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="guide" element={<Navigate to="/guide" replace />} />
              <Route path="guide/:slug" element={<AppGuideRedirect />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </MomentProvider>
    </AppProvider>
  )
}
