import MembersPanel from '@/components/MembersPanel'

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Members
      </h1>
      <MembersPanel />
    </div>
  )
}