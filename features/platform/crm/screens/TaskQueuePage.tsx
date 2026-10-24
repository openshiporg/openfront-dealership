import { getCrmRooftops, getCrmViewer, getStaffForRooftops, getTaskQueue, type TaskQueueFilters } from '../actions'
import { TaskQueuePageClient } from './TaskQueuePageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { zonedDayBounds } from '../lib/leadOptions'

export async function TaskQueuePage() {
  const [viewer, rooftops, timeZone] = await Promise.all([getCrmViewer(), getCrmRooftops(), getDealershipTimeZone()])
  const { start, end } = zonedDayBounds(timeZone)
  const initialFilters: TaskQueueFilters = { bucket: 'overdue', scope: 'mine', assigneeId: 'all', todayStart: start, todayEnd: end }
  const [response, staff] = await Promise.all([
    viewer ? getTaskQueue(initialFilters, viewer.id) : Promise.resolve({ success: false as const, error: 'Sign in to view tasks' }),
    viewer?.canViewAllLeads ? getStaffForRooftops(rooftops.map(rooftop => rooftop.id)) : Promise.resolve([]),
  ])

  return (
    <TaskQueuePageClient
      viewer={viewer}
      staff={staff}
      initialFilters={initialFilters}
      initialData={response.success ? response.data : null}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default TaskQueuePage
