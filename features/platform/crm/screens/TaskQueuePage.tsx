import { getCrmRooftops, getCrmViewer, getStaffForRooftops, getTaskQueue, type TaskQueueFilters } from '../actions'
import { TaskQueuePageClient } from './TaskQueuePageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { zonedDayBounds } from '../lib/leadOptions'

export async function TaskQueuePage() {
  const [viewer, rooftops, timeZone] = await Promise.all([getCrmViewer(), getCrmRooftops(), getDealershipTimeZone()])
  const { start, end } = zonedDayBounds(timeZone)
  // "Due today" (mine, overdue then today) leads the page; the full list below opens on upcoming work.
  const initialFilters: TaskQueueFilters = { bucket: 'upcoming', scope: 'mine', assigneeId: 'all', todayStart: start, todayEnd: end }
  const signedOut = { success: false as const, error: 'Sign in to view tasks' }
  const [response, overdueResponse, todayResponse, staff] = await Promise.all([
    viewer ? getTaskQueue(initialFilters, viewer.id) : Promise.resolve(signedOut),
    viewer ? getTaskQueue({ ...initialFilters, bucket: 'overdue' }, viewer.id) : Promise.resolve(signedOut),
    viewer ? getTaskQueue({ ...initialFilters, bucket: 'today' }, viewer.id) : Promise.resolve(signedOut),
    viewer?.canViewAllLeads ? getStaffForRooftops(rooftops.map(rooftop => rooftop.id)) : Promise.resolve([]),
  ])

  return (
    <TaskQueuePageClient
      viewer={viewer}
      staff={staff}
      initialFilters={initialFilters}
      initialData={response.success ? response.data : null}
      initialDueToday={overdueResponse.success && todayResponse.success ? [...overdueResponse.data.tasks, ...todayResponse.data.tasks] : null}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default TaskQueuePage
