import { useParams } from 'common'
import { useFeaturePreviewContext } from 'components/interfaces/App/FeaturePreview/FeaturePreviewContext'
import ProjectAPIDocs from 'components/interfaces/ProjectAPIDocs/ProjectAPIDocs'
import { AIAssistantPanel } from 'components/ui/AIAssistantPanel/AIAssistantPanel'
import AISettingsModal from 'components/ui/AISettingsModal'
import { Loading } from 'components/ui/Loading'
import { ResourceExhaustionWarningBanner } from 'components/ui/ResourceExhaustionWarningBanner/ResourceExhaustionWarningBanner'
import { AnimatePresence, motion } from 'framer-motion'
import { useSelectedOrganization } from 'hooks/misc/useSelectedOrganization'
import { useSelectedProject } from 'hooks/misc/useSelectedProject'
import { withAuth } from 'hooks/misc/withAuth'
import { useActionKey } from 'hooks/useActionKey'
import { IS_PLATFORM, LOCAL_STORAGE_KEYS, PROJECT_STATUS } from 'lib/constants'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { forwardRef, Fragment, PropsWithChildren, ReactNode, useEffect, useState } from 'react'
import { useAppStateSnapshot } from 'state/app-state'
import { useDatabaseSelectorStateSnapshot } from 'state/database-selector'
import { cn, ResizableHandle, ResizablePanel, ResizablePanelGroup } from 'ui'
import { useSnapshot } from 'valtio'
import EnableBranchingModal from '../AppLayout/EnableBranchingButton/EnableBranchingModal'
import { useEditorType } from '../editors/editors-layout.hooks'
import { sidebarState } from '../tabs/sidebar-state'
import BuildingState from './BuildingState'
import ConnectingState from './ConnectingState'
import { LayoutHeader } from './LayoutHeader'
import LoadingState from './LoadingState'
import NavigationBar from './NavigationBar/NavigationBar'
import { ProjectPausedState } from './PausedState/ProjectPausedState'
import PauseFailedState from './PauseFailedState'
import PausingState from './PausingState'
import ProductMenuBar from './ProductMenuBar'
import { ProjectContextProvider } from './ProjectContext'
import { ResizingState } from './ResizingState'
import RestartingState from './RestartingState'
import RestoreFailedState from './RestoreFailedState'
import RestoringState from './RestoringState'
import { UpgradingState } from './UpgradingState'
import { ProjectNavigationBarHorizontal } from './NavigationBar/navigation-bar-horizontal'

// [Joshen] This is temporary while we unblock users from managing their project
// if their project is not responding well for any reason. Eventually needs a bit of an overhaul
const routesToIgnoreProjectDetailsRequest = [
  '/project/[ref]/settings/general',
  '/project/[ref]/settings/database',
  '/project/[ref]/settings/storage',
  '/project/[ref]/settings/infrastructure',
  '/project/[ref]/settings/addons',
]

const routesToIgnoreDBConnection = [
  '/project/[ref]/branches',
  '/project/[ref]/database/backups/scheduled',
  '/project/[ref]/database/backups/pitr',
  '/project/[ref]/settings/addons',
]

const routesToIgnorePostgrestConnection = [
  '/project/[ref]/reports',
  '/project/[ref]/settings/general',
  '/project/[ref]/settings/database',
  '/project/[ref]/settings/infrastructure',
  '/project/[ref]/settings/addons',
]

export interface ProjectLayoutProps {
  title?: string
  isLoading?: boolean
  isBlocking?: boolean
  product?: string
  productMenu?: ReactNode
  hideHeader?: boolean
  hideIconBar?: boolean
  selectedTable?: string
  resizableSidebar?: boolean
}

const ProjectLayout = forwardRef<HTMLDivElement, PropsWithChildren<ProjectLayoutProps>>(
  (
    {
      title,
      isLoading = false,
      isBlocking = true,
      product = '',
      productMenu,
      children,
      hideHeader = false,
      hideIconBar = false,
      selectedTable,
      resizableSidebar = false,
    },
    ref
  ) => {
    const router = useRouter()
    const { ref: projectRef } = useParams()
    const selectedOrganization = useSelectedOrganization()
    const selectedProject = useSelectedProject()
    const { aiAssistantPanel, setAiAssistantPanel } = useAppStateSnapshot()
    const { open } = aiAssistantPanel

    // tabs preview flag logic
    const editor = useEditorType()
    const { flags } = useFeaturePreviewContext()
    const tableEditorTabsEnabled =
      editor === 'table' && !flags[LOCAL_STORAGE_KEYS.UI_TABLE_EDITOR_TABS]
    const sqlEditorTabsEnabled = editor === 'sql' && !flags[LOCAL_STORAGE_KEYS.UI_SQL_EDITOR_TABS]
    const forceShowProductMenu = tableEditorTabsEnabled && !sqlEditorTabsEnabled
    // end of tabs preview flag logic
    const projectName = selectedProject?.name
    const organizationName = selectedOrganization?.name

    const isPaused = selectedProject?.status === PROJECT_STATUS.INACTIVE
    const showProductMenu = selectedProject
      ? selectedProject.status === PROJECT_STATUS.ACTIVE_HEALTHY ||
        (selectedProject.status === PROJECT_STATUS.COMING_UP &&
          router.pathname.includes('/project/[ref]/settings'))
      : true

    const ignorePausedState =
      router.pathname === '/project/[ref]' || router.pathname.includes('/project/[ref]/settings')
    const showPausedState = isPaused && !ignorePausedState

    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
      setIsClient(true)
    }, [])

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.metaKey && e.code === 'KeyI' && !e.altKey && !e.shiftKey) {
          setAiAssistantPanel({ open: !open })
          e.preventDefault()
          e.stopPropagation()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const sidebar = useSnapshot(sidebarState)
    const actionKey = useActionKey()

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const isActionKeyPressed = e.key === actionKey?.[1]
        if (e.key.toLowerCase() === 'b' && isActionKeyPressed) {
          e.preventDefault()
          sidebarState.isOpen = !sidebar.isOpen
        }
      }
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [actionKey, sidebar.isOpen])

    const sideBarIsOpen = forceShowProductMenu ? true : sidebar.isOpen

    return (
      <ProjectContextProvider projectRef={projectRef}>
        <Head>
          <title>
            {title
              ? `${title} | Supabase`
              : selectedTable
                ? `${selectedTable} | ${projectName} | ${organizationName} | Supabase`
                : projectName
                  ? `${projectName} | ${organizationName} | Supabase`
                  : organizationName
                    ? `${organizationName} | Supabase`
                    : 'Supabase'}
          </title>
          <meta name="description" content="Supabase Studio" />
        </Head>
        <div className="flex flex-row h-full w-full">
          {/* <ProjectNavigationBarHorizontal /> */}
          {/* <div className="flex h-full flex-row flex-grow gap-1"> */}
          {/* {!hideIconBar && <NavigationBar />} */}
          <div
            className={cn(
              'border-l w-full rounded-tl-[7px] rounded-bl-[7px] border-t border-b flex-row my-1.5'
            )}
          >
            <ResizablePanelGroup className="" direction="horizontal" autoSaveId="project-layout">
              {showProductMenu && productMenu && (
                <ResizablePanel
                  order={1}
                  id="panel-left"
                  className={cn(
                    'transition-all duration-[120ms]',
                    sideBarIsOpen
                      ? resizableSidebar
                        ? 'min-w-64 max-w-[32rem]'
                        : 'min-w-64 max-w-64'
                      : 'w-0 flex-shrink-0 max-w-0'
                  )}
                >
                  {sideBarIsOpen && (
                    <AnimatePresence>
                      <motion.div
                        initial={{ width: 0, opacity: 0, height: '100%' }}
                        animate={{ width: 'auto', opacity: 1, height: '100%' }}
                        exit={{ width: 0, opacity: 0, height: '100%' }}
                        className="h-full"
                        transition={{ duration: 0.12 }}
                      >
                        <MenuBarWrapper
                          isLoading={isLoading}
                          isBlocking={isBlocking}
                          productMenu={productMenu}
                        >
                          <ProductMenuBar title={product}>{productMenu}</ProductMenuBar>
                        </MenuBarWrapper>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </ResizablePanel>
              )}
              {showProductMenu && productMenu && sideBarIsOpen && (
                <ResizableHandle withHandle disabled={resizableSidebar ? false : true} />
              )}
              <ResizablePanel order={2} id="panel-right" className="h-full flex flex-col w-full">
                <ResizablePanelGroup
                  className="h-full w-full overflow-x-hidden flex-1 flex flex-row gap-1"
                  direction="horizontal"
                  autoSaveId="project-layout-content"
                >
                  <ResizablePanel
                    id="panel-content"
                    className={cn(
                      'w-full min-w-[600px] bg-dash-sidebar',
                      aiAssistantPanel.open && 'border-r rounded-tr-[7px]'
                    )}
                  >
                    <main
                      className="h-full flex flex-col flex-1 w-full overflow-y-auto overflow-x-hidden"
                      ref={ref}
                    >
                      {showPausedState ? (
                        <div className="mx-auto my-16 w-full h-full max-w-7xl flex items-center">
                          <div className="w-full">
                            <ProjectPausedState product={product} />
                          </div>
                        </div>
                      ) : (
                        <ContentWrapper isLoading={isLoading} isBlocking={isBlocking}>
                          <Fragment key={selectedProject?.ref}>
                            <ResourceExhaustionWarningBanner />
                            {children}
                          </Fragment>
                        </ContentWrapper>
                      )}
                    </main>
                  </ResizablePanel>
                  {isClient && aiAssistantPanel.open && (
                    <>
                      <ResizableHandle
                        withHandle
                        className="opacity-0 focus-within:opacity-100 hover:opacity-100"
                      />
                      <ResizablePanel
                        id="panel-assistant"
                        className={cn(
                          'bg absolute right-0 top-[48px] bottom-0 xl:relative xl:top-0',
                          'min-w-[400px] max-w-[500px]',
                          '2xl:min-w-[500px] 2xl:max-w-[600px]',
                          'border-l border-t rounded-tl-[7px]'
                        )}
                      >
                        <AIAssistantPanel />
                      </ResizablePanel>
                    </>
                  )}
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
          {/* </div> */}
        </div>
        <EnableBranchingModal />
        <AISettingsModal />
        <ProjectAPIDocs />
      </ProjectContextProvider>
    )
  }
)

ProjectLayout.displayName = 'ProjectLayout'

export const ProjectLayoutWithAuth = withAuth(ProjectLayout)

export default ProjectLayout

interface MenuBarWrapperProps {
  isLoading: boolean
  isBlocking?: boolean
  productMenu?: ReactNode
  children: ReactNode
}

const MenuBarWrapper = ({
  isLoading,
  isBlocking = true,
  productMenu,
  children,
}: MenuBarWrapperProps) => {
  const router = useRouter()
  const selectedProject = useSelectedProject()

  const requiresProjectDetails = !routesToIgnoreProjectDetailsRequest.includes(router.pathname)

  if (!isBlocking) {
    return children
  }

  const showMenuBar =
    !requiresProjectDetails || (requiresProjectDetails && selectedProject !== undefined)

  return !isLoading && productMenu && showMenuBar ? children : null
}

interface ContentWrapperProps {
  isLoading: boolean
  isBlocking?: boolean
  children: ReactNode
}

/**
 * Check project.status to show building state or error state
 *
 * [Joshen] As of 210422: Current testing connection by pinging postgres
 * Ideally we'd have a more specific monitoring of the project such as during restarts
 * But that will come later: https://supabase.slack.com/archives/C01D6TWFFFW/p1650427619665549
 *
 * Just note that this logic does not differentiate between a "restarting" state and
 * a "something is wrong and can't connect to project" state.
 *
 * [TODO] Next iteration should scrape long polling and just listen to the project's status
 */
const ContentWrapper = ({ isLoading, isBlocking = true, children }: ContentWrapperProps) => {
  const router = useRouter()
  const { ref } = useParams()
  const state = useDatabaseSelectorStateSnapshot()
  const selectedProject = useSelectedProject()

  const isSettingsPages = router.pathname.includes('/project/[ref]/settings')
  const isVaultPage = router.pathname === '/project/[ref]/settings/vault'
  const isBackupsPage = router.pathname.includes('/project/[ref]/database/backups')

  const requiresDbConnection: boolean =
    (!isSettingsPages && !routesToIgnoreDBConnection.includes(router.pathname)) || isVaultPage
  const requiresPostgrestConnection = !routesToIgnorePostgrestConnection.includes(router.pathname)
  const requiresProjectDetails = !routesToIgnoreProjectDetailsRequest.includes(router.pathname)

  const isRestarting = selectedProject?.status === PROJECT_STATUS.RESTARTING
  const isResizing = selectedProject?.status === PROJECT_STATUS.RESIZING
  const isProjectUpgrading = selectedProject?.status === PROJECT_STATUS.UPGRADING
  const isProjectRestoring = selectedProject?.status === PROJECT_STATUS.RESTORING
  const isProjectRestoreFailed = selectedProject?.status === PROJECT_STATUS.RESTORE_FAILED
  const isProjectBuilding =
    selectedProject?.status === PROJECT_STATUS.COMING_UP ||
    selectedProject?.status === PROJECT_STATUS.UNKNOWN
  const isProjectPausing =
    selectedProject?.status === PROJECT_STATUS.GOING_DOWN ||
    selectedProject?.status === PROJECT_STATUS.PAUSING
  const isProjectPauseFailed = selectedProject?.status === PROJECT_STATUS.PAUSE_FAILED
  const isProjectOffline = selectedProject?.postgrestStatus === 'OFFLINE'

  useEffect(() => {
    if (ref) state.setSelectedDatabaseId(ref)
  }, [ref])

  if (isBlocking && (isLoading || (requiresProjectDetails && selectedProject === undefined))) {
    return router.pathname.endsWith('[ref]') ? <LoadingState /> : <Loading />
  }

  if (isRestarting && !isBackupsPage) {
    return <RestartingState />
  }

  if (isResizing && !isBackupsPage) {
    return <ResizingState />
  }

  if (isProjectUpgrading && !isBackupsPage) {
    return <UpgradingState />
  }

  if (isProjectPausing) {
    return <PausingState project={selectedProject} />
  }

  if (isProjectPauseFailed) {
    return <PauseFailedState />
  }

  if (requiresPostgrestConnection && isProjectOffline) {
    return <ConnectingState project={selectedProject} />
  }

  if (requiresDbConnection && isProjectRestoring) {
    return <RestoringState />
  }

  if (isProjectRestoreFailed && !isBackupsPage) {
    return <RestoreFailedState />
  }

  if (requiresDbConnection && isProjectBuilding) {
    return <BuildingState />
  }

  return <Fragment key={selectedProject?.ref}>{children}</Fragment>
}
