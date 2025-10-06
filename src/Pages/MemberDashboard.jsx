import React from 'react'
import { User, Target, Award, Clock } from 'lucide-react'
import StatsCard from '../components/StatsCard'

const MemberDashboard = () => {
  const stats = [
    {
      title: 'Profile Completion',
      value: '85%',
      icon: User,
      description: 'Complete your profile',
      color: 'blue'
    },
    {
      title: 'Tasks Completed',
      value: '42',
      icon: Target,
      description: 'This month',
      color: 'green'
    },
    {
      title: 'Achievements',
      value: '8',
      icon: Award,
      description: 'Unlocked badges',
      color: 'orange'
    },
    {
      title: 'Hours Logged',
      value: '156',
      icon: Clock,
      description: 'This month',
      color: 'purple'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Member Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's your overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {['Task completed: Project Setup', 'Profile updated', 'New achievement unlocked', 'Team meeting attended'].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700">{activity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {['Update Profile', 'View Tasks', 'Submit Report', 'Request Support'].map((action, index) => (
              <button
                key={index}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MemberDashboard