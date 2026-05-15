import { useState, useEffect } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Trash2, Users, Calendar, Clock } from 'lucide-react-taro'

// 流派选项（燕云十六声门派）
const SCHOOL_OPTIONS = [
  '虹虹', '影影', '风风', '尘尘', '鸢鸢', '威威', '钧钧', '玉玉', '霖霖', '翊翊', '其它'
]

// 时段选项
const TIME_SLOT_OPTIONS = [
  { value: '上午', label: '上午 (9:00-12:00)' },
  { value: '下午', label: '下午 (14:00-18:00)' },
  { value: '晚上', label: '晚上 (19:00-22:00)' },
  { value: '深夜', label: '深夜 (22:00-次日2:00)' }
]

// 报名记录类型
interface RaidRegistration {
  id: number
  player_id: string
  school: string
  raid_date: string
  raid_time_slot: string
  group_number: number
  created_at: string
}

// 分组类型
interface GroupedRegistrations {
  [key: string]: RaidRegistration[]
}

export default function IndexPage() {
  const [playerId, setPlayerId] = useState('')
  const [schoolIndex, setSchoolIndex] = useState(0)
  const [timeSlotIndex, setTimeSlotIndex] = useState(0)
  const [selectedDate, setSelectedDate] = useState('')
  const [registrations, setRegistrations] = useState<RaidRegistration[]>([])
  const [groupedData, setGroupedData] = useState<GroupedRegistrations>({})
  const [loading, setLoading] = useState(false)

  // 获取今天的日期字符串
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    // 初始化日期为今天
    setSelectedDate(getTodayDate())
    // 加载报名列表
    fetchRegistrations()
  }, [])

  // 获取报名列表
  const fetchRegistrations = async () => {
    try {
      const res = await Network.request({
        url: '/api/raid-registrations',
        method: 'GET'
      })
      console.log('获取报名列表响应:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const data = res.data.data as RaidRegistration[]
        setRegistrations(data)
        // 计算分组
        calculateGroups(data)
      }
    } catch (error) {
      console.error('获取报名列表失败:', error)
    }
  }

  // 计算分组（按日期+时段分组，每组最多10人）
  const calculateGroups = (data: RaidRegistration[]) => {
    const grouped: GroupedRegistrations = {}
    
    // 按日期+时段分组
    data.forEach(reg => {
      const key = `${reg.raid_date}_${reg.raid_time_slot}`
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(reg)
    })

    // 为每个分组内的成员分配组号
    Object.keys(grouped).forEach(key => {
      const members = grouped[key]
      members.forEach((member, index) => {
        member.group_number = Math.floor(index / 10) + 1
      })
    })

    setGroupedData(grouped)
  }

  // 提交报名
  const handleSubmit = async () => {
    if (!playerId.trim()) {
      Taro.showToast({ title: '请输入玩家ID', icon: 'none' })
      return
    }
    if (!selectedDate) {
      Taro.showToast({ title: '请选择打本日期', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/raid-registrations',
        method: 'POST',
        data: {
          player_id: playerId.trim(),
          school: SCHOOL_OPTIONS[schoolIndex],
          raid_date: selectedDate,
          raid_time_slot: TIME_SLOT_OPTIONS[timeSlotIndex].value
        }
      })
      console.log('提交报名响应:', res.data)

      if (res.data?.code === 200) {
        Taro.showToast({ title: '报名成功', icon: 'success' })
        setPlayerId('')
        fetchRegistrations()
      } else {
        Taro.showToast({ title: res.data?.msg || '报名失败', icon: 'none' })
      }
    } catch (error) {
      console.error('提交报名失败:', error)
      Taro.showToast({ title: '报名失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 删除报名
  const handleDelete = async (id: number) => {
    try {
      const res = await Network.request({
        url: `/api/raid-registrations/${id}`,
        method: 'DELETE'
      })
      console.log('删除报名响应:', res.data)

      if (res.data?.code === 200) {
        Taro.showToast({ title: '删除成功', icon: 'success' })
        fetchRegistrations()
      }
    } catch (error) {
      console.error('删除报名失败:', error)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  // 日期选择变化
  const handleDateChange = (e) => {
    setSelectedDate(e.detail.value)
  }

  // 流派选择变化
  const handleSchoolChange = (e) => {
    setSchoolIndex(Number(e.detail.value))
  }

  // 时段选择变化
  const handleTimeSlotChange = (e) => {
    setTimeSlotIndex(Number(e.detail.value))
  }

  // 统计总人数
  const totalCount = registrations.length

  return (
    <View className="min-h-full bg-gray-50 p-4 pb-20">
      {/* 标题区 */}
      <View className="mb-4">
        <Text className="block text-xl font-bold text-gray-900">打本报名</Text>
        <Text className="block text-sm text-gray-500 mt-1">
          当前已报名 <Text className="text-indigo-500 font-semibold">{totalCount}</Text> 人
        </Text>
      </View>

      {/* 报名表单区 */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">填写报名信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 玩家ID */}
          <View>
            <Label className="text-sm text-gray-700 mb-1 block">玩家ID</Label>
            <View className="bg-gray-50 rounded-lg px-3 py-2">
              <Input
                className="w-full bg-transparent"
                placeholder="请输入您的游戏ID"
                value={playerId}
                onInput={(e) => setPlayerId(e.detail.value)}
              />
            </View>
          </View>

          {/* 流派选择 */}
          <View>
            <Label className="text-sm text-gray-700 mb-1 block">流派</Label>
            <Picker mode="selector" range={SCHOOL_OPTIONS} value={schoolIndex} onChange={handleSchoolChange}>
              <View className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between items-center">
                <Text className={schoolIndex >= 0 ? 'text-gray-900' : 'text-gray-400'}>
                  {SCHOOL_OPTIONS[schoolIndex]}
                </Text>
                <Text className="text-gray-400 text-sm">▼</Text>
              </View>
            </Picker>
          </View>

          {/* 打本日期 */}
          <View>
            <Label className="text-sm text-gray-700 mb-1 block">打本日期</Label>
            <Picker mode="date" value={selectedDate} start={getTodayDate()} onChange={handleDateChange}>
              <View className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between items-center">
                <Text className={selectedDate ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedDate || '请选择日期'}
                </Text>
                <Calendar size={18} color="#64748b" />
              </View>
            </Picker>
          </View>

          {/* 打本时段 */}
          <View>
            <Label className="text-sm text-gray-700 mb-1 block">打本时段</Label>
            <Picker mode="selector" range={TIME_SLOT_OPTIONS.map(t => t.label)} value={timeSlotIndex} onChange={handleTimeSlotChange}>
              <View className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between items-center">
                <Text className="text-gray-900">{TIME_SLOT_OPTIONS[timeSlotIndex].label}</Text>
                <Clock size={18} color="#64748b" />
              </View>
            </Picker>
          </View>

          {/* 提交按钮 */}
          <Button
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '提交中...' : '立即报名'}
          </Button>
        </CardContent>
      </Card>

      {/* 分组结果区 */}
      {Object.keys(groupedData).length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center">
              <Users size={18} color="#6366f1" className="mr-2" />
              分组结果
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(groupedData).map(([key, members]) => {
              const [date, timeSlot] = key.split('_')
              // 按组号分组
              const groupsByNumber: { [groupNum: number]: RaidRegistration[] } = {}
              members.forEach(m => {
                const groupNum = m.group_number || 1
                if (!groupsByNumber[groupNum]) {
                  groupsByNumber[groupNum] = []
                }
                groupsByNumber[groupNum].push(m)
              })

              return (
                <View key={key} className="mb-4 last:mb-0">
                  <View className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200">
                      {date} {timeSlot}
                    </Badge>
                    <Text className="text-xs text-gray-500">共 {members.length} 人</Text>
                  </View>
                  
                  {Object.entries(groupsByNumber).map(([groupNum, groupMembers]) => (
                    <View key={groupNum} className="mb-2">
                      <Text className="text-sm font-medium text-gray-700 mb-1">
                        第 {groupNum} 组 ({groupMembers.length}/10人)
                      </Text>
                      <View className="bg-gray-50 rounded-lg p-2">
                        <View className="flex flex-wrap gap-2">
                          {groupMembers.map(member => (
                            <View key={member.id} className="bg-white rounded-md px-2 py-1 border border-gray-200">
                              <Text className="text-xs text-gray-700">{member.player_id}</Text>
                              <Text className="text-xs text-indigo-500 ml-1">·{member.school}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  ))}
                  
                  <Separator className="my-3" />
                </View>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* 报名列表区 */}
      {registrations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">报名列表</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {registrations.map((reg, index) => (
              <View key={reg.id}>
                <View className="flex items-center justify-between px-4 py-3">
                  <View className="flex-1">
                    <View className="flex items-center gap-2">
                      <Text className="font-medium text-gray-900">{reg.player_id}</Text>
                      <Badge variant="secondary" className="text-xs">{reg.school}</Badge>
                    </View>
                    <Text className="text-xs text-gray-500 mt-1">
                      {reg.raid_date} {reg.raid_time_slot}
                    </Text>
                  </View>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(reg.id)}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </Button>
                </View>
                {index < registrations.length - 1 && <Separator />}
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 空状态 */}
      {registrations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Text className="text-gray-400">暂无报名记录</Text>
            <Text className="text-sm text-gray-400 mt-1">快来第一个报名吧！</Text>
          </CardContent>
        </Card>
      )}
    </View>
  )
}
