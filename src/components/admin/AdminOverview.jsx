import { Link } from 'react-router-dom'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { 
  Users, 
  BookOpen, 
  MessageCircle, 
  TrendingUp,
  Settings,
  Database,
  Shield,
  BarChart3
} from 'lucide-react'

const AdminOverview = () => {
  const stats = [
    {
      title: 'Tổng người dùng',
      value: '1,234',
      change: '+12%',
      changeType: 'positive',
      icon: Users,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'Bài tập hoàn thành',
      value: '15,678',
      change: '+8%',
      changeType: 'positive',
      icon: BookOpen,
      color: 'bg-green-100 text-green-600'
    },
    {
      title: 'Ticket hỗ trợ',
      value: '23',
      change: '-5%',
      changeType: 'negative',
      icon: MessageCircle,
      color: 'bg-yellow-100 text-yellow-600'
    },
    {
      title: 'Hoạt động hôm nay',
      value: '456',
      change: '+15%',
      changeType: 'positive',
      icon: TrendingUp,
      color: 'bg-purple-100 text-purple-600'
    }
  ]

  const quickActions = [
    {
      title: 'Quản lý người dùng',
      description: 'Xem và quản lý tài khoản người dùng',
      icon: Users,
      path: '/admin/users',
      color: 'bg-blue-600'
    },
    {
      title: 'Hỗ trợ khách hàng',
      description: 'Xử lý ticket và yêu cầu hỗ trợ',
      icon: MessageCircle,
      path: '/admin/support',
      color: 'bg-green-600'
    },
    {
      title: 'Cài đặt hệ thống',
      description: 'Cấu hình và thiết lập ứng dụng',
      icon: Settings,
      path: '/admin/settings',
      color: 'bg-purple-600'
    },
    {
      title: 'Báo cáo thống kê',
      description: 'Xem báo cáo chi tiết về hoạt động',
      icon: BarChart3,
      path: '/admin/reports',
      color: 'bg-orange-600'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quản trị hệ thống</h1>
          <p className="text-gray-600">Tổng quan và quản lý ứng dụng MomTek</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Hệ thống hoạt động bình thường</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <Card.Content className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className={`text-sm ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change} từ tháng trước
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Hành động nhanh</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => (
            <Link key={index} to={action.path}>
              <Card hover className="h-full">
                <Card.Content className="p-6 text-center">
                  <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center mx-auto mb-4`}>
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{action.title}</h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </Card.Content>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Người dùng mới gần đây</h3>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              {[
                { name: 'Nguyễn Văn A', email: 'a@example.com', time: '2 phút trước' },
                { name: 'Trần Thị B', email: 'b@example.com', time: '15 phút trước' },
                { name: 'Lê Minh C', email: 'c@example.com', time: '1 giờ trước' }
              ].map((user, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{user.time}</div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Ticket hỗ trợ chờ xử lý</h3>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              {[
                { id: '#1234', subject: 'Không thể đăng nhập', priority: 'Cao', time: '30 phút trước' },
                { id: '#1235', subject: 'Lỗi phát âm', priority: 'Trung bình', time: '1 giờ trước' },
                { id: '#1236', subject: 'Câu hỏi về tính năng', priority: 'Thấp', time: '2 giờ trước' }
              ].map((ticket, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{ticket.id}</div>
                    <div className="text-sm text-gray-600">{ticket.subject}</div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      ticket.priority === 'Cao' ? 'bg-red-100 text-red-700' :
                      ticket.priority === 'Trung bình' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {ticket.priority}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">{ticket.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-green-600" />
            Tình trạng hệ thống
          </h3>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { service: 'API Server', status: 'Hoạt động', uptime: '99.9%', color: 'text-green-600' },
              { service: 'Database', status: 'Hoạt động', uptime: '99.8%', color: 'text-green-600' },
              { service: 'File Storage', status: 'Hoạt động', uptime: '99.7%', color: 'text-green-600' }
            ].map((service, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{service.service}</div>
                  <div className={`text-sm ${service.color}`}>{service.status}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{service.uptime}</div>
                  <div className="text-xs text-gray-600">Uptime</div>
                </div>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>
    </div>
  )
}

export default AdminOverview
