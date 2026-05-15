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
import { Trash2, Users, Calendar, Clock, Download } from 'lucide-react-taro'

// 报名类型选项
const REGISTRATION_TYPE_OPTIONS = [
  { value: '打本报名', label: '打本报名' },
  { value: '百业战报名', label: '百业战报名' },
  { value: '其他活动报名', label: '其他活动报名' }
]

// 流派选项（燕云十六声门派）
const SCHOOL_OPTIONS = [
  '虹虹', '影影', '风风', '尘尘', '鸢鸢', '威威', '钧钧', '玉玉', '霖霖', '翊翊', '其它'
]

// 打本时段选项
const RAID_TIME_SLOT_OPTIONS = [
  { value: '7点半', label: '7点半' },
  { value: '8点半', label: '8点半' },
  { value: '9点半', label: '9点半' },
  { value: '额外附加时间', label: '额外附加时间' }
]

// 百业战时间选项
const BAIYE_TIME_OPTIONS = [
  { value: '周六', label: '周六' },
  { value: '周日', label: '周日' },
  { value: '周六及周日', label: '周六及周日' }
]

// 小队选项
const TEAM_OPTIONS = [
  { value: '进攻组', label: '进攻组' },
  { value: '防守组', label: '防守组' }
]

// 报名记录类型
interface RaidRegistration {
  id: number
  registration_type: string
  player_id: string
  school: string
  is_commander: boolean
  raid_date: string
  raid_time_slot: string
  team: string | null
  group_number: number
  created_at: string
}

// 分组警告类型
interface GroupWarning {
  raid_date: string
  raid_time_slot: string
  group_number: number
  linlin_count: number
  warning: string
}

// 分组类型
interface GroupedRegistrations {
  [key: string]: RaidRegistration[]
}

export default function IndexPage() {
  const [registrationTypeIndex, setRegistrationTypeIndex] = useState(0)
  const [playerId, setPlayerId] = useState('')
  const [schoolIndex, setSchoolIndex] = useState(0)
  const [timeSlotIndex, setTimeSlotIndex] = useState(0)
  const [baiyeTimeIndex, setBaiyeTimeIndex] = useState(0)
  const [teamIndex, setTeamIndex] = useState(0)
  const [selectedDate, setSelectedDate] = useState('')
  const [isCommander, setIsCommander] = useState(false)
  const [registrations, setRegistrations] = useState<RaidRegistration[]>([])
  const [groupedData, setGroupedData] = useState<GroupedRegistrations>({})
  const [baiyeData, setBaiyeData] = useState<GroupedRegistrations>({})
  const [otherActivityData, setOtherActivityData] = useState<GroupedRegistrations>({})
  const [warnings, setWarnings] = useState<GroupWarning[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  
  // 当前选择的报名类型
  const currentRegistrationType = REGISTRATION_TYPE_OPTIONS[registrationTypeIndex]?.value || '打本报名'
  
  // 根据报名类型判断是否显示日期选择（百业战不显示日期选择，显示时间选项）
  const showDatePicker = currentRegistrationType !== '百业战报名'
  const showBaiyeOptions = currentRegistrationType === '百业战报名'
  const showTimeSlotPicker = currentRegistrationType === '打本报名'

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
        const warningsData = res.data.warnings as GroupWarning[] || []
        setRegistrations(data)
        setWarnings(warningsData)
        // 计算分组
        calculateGroups(data)
      }
    } catch (error) {
      console.error('获取报名列表失败:', error)
    }
  }

  // 计算分组（按报名类型、日期+时段分组）
  const calculateGroups = (data: RaidRegistration[]) => {
    const raidGrouped: GroupedRegistrations = {}
    const baiyeGrouped: GroupedRegistrations = {}
    const otherGrouped: GroupedRegistrations = {}
    
    // 分离打本报名、百业战报名和其他活动报名
    data.forEach(reg => {
      const key = `${reg.raid_date}_${reg.raid_time_slot}`
      
      if (reg.registration_type === '打本报名') {
        if (!raidGrouped[key]) {
          raidGrouped[key] = []
        }
        raidGrouped[key].push(reg)
      } else if (reg.registration_type === '百业战报名') {
        // 百业战按日期+小队分组
        const baiyeKey = `${reg.raid_date}_${reg.team || '未分配'}`
        if (!baiyeGrouped[baiyeKey]) {
          baiyeGrouped[baiyeKey] = []
        }
        baiyeGrouped[baiyeKey].push(reg)
      } else {
        if (!otherGrouped[key]) {
          otherGrouped[key] = []
        }
        otherGrouped[key].push(reg)
      }
    })

    setGroupedData(raidGrouped)
    setBaiyeData(baiyeGrouped)
    setOtherActivityData(otherGrouped)
  }

  // 提交报名
  const handleSubmit = async () => {
    if (!playerId.trim()) {
      Taro.showToast({ title: '请输入玩家ID', icon: 'none' })
      return
    }
    
    // 打本报名和其他活动报名需要选择日期
    if (showDatePicker && !selectedDate) {
      Taro.showToast({ title: '请选择日期', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      // 根据报名类型构建不同的请求数据
      const requestData: Record<string, any> = {
        registration_type: currentRegistrationType,
        player_id: playerId.trim(),
        school: SCHOOL_OPTIONS[schoolIndex],
        is_commander: isCommander
      }
      
      if (currentRegistrationType === '打本报名') {
        requestData.raid_date = selectedDate
        requestData.raid_time_slot = RAID_TIME_SLOT_OPTIONS[timeSlotIndex].value
      } else if (currentRegistrationType === '百业战报名') {
        requestData.raid_date = BAIYE_TIME_OPTIONS[baiyeTimeIndex].value
        requestData.raid_time_slot = BAIYE_TIME_OPTIONS[baiyeTimeIndex].value
        requestData.team = TEAM_OPTIONS[teamIndex].value
      } else {
        requestData.raid_date = selectedDate
        requestData.raid_time_slot = '全天'
      }
      
      const res = await Network.request({
        url: '/api/raid-registrations',
        method: 'POST',
        data: requestData
      })
      console.log('提交报名响应:', res.data)

      if (res.data?.code === 200) {
        Taro.showToast({ title: '报名成功', icon: 'success' })
        setPlayerId('')
        setIsCommander(false)
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

  // 导出Excel
  const handleExportExcel = async () => {
    if (registrations.length === 0) {
      Taro.showToast({ title: '暂无数据可导出', icon: 'none' })
      return
    }

    setExporting(true)
    try {
      // H5端直接下载
      if (Taro.getEnv() === 'WEB') {
        const link = document.createElement('a')
        link.href = '/api/raid-registrations/export/excel'
        link.download = `活动报名统计_${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        // 小程序端
        Taro.downloadFile({
          url: '/api/raid-registrations/export/excel',
          success: (res) => {
            if (res.statusCode === 200) {
              Taro.openDocument({
                filePath: res.tempFilePath,
                fileType: 'xlsx',
                success: () => {
                  Taro.showToast({ title: '导出成功', icon: 'success' })
                }
              })
            }
          },
          fail: () => {
            Taro.showToast({ title: '导出失败', icon: 'none' })
          }
        })
      }
    } catch (error) {
      console.error('导出Excel失败:', error)
      Taro.showToast({ title: '导出失败', icon: 'none' })
    } finally {
      setExporting(false)
    }
  }

  // 日期选择变化
  const handleDateChange = (e) => {
    setSelectedDate(e.detail.value)
  }

  // 报名类型选择变化
  const handleRegistrationTypeChange = (e) => {
    setRegistrationTypeIndex(Number(e.detail.value))
  }

  // 流派选择变化
  const handleSchoolChange = (e) => {
    setSchoolIndex(Number(e.detail.value))
  }

  // 时段选择变化
  const handleTimeSlotChange = (e) => {
    setTimeSlotIndex(Number(e.detail.value))
  }

  // 统计人数
  const raidCount = registrations.filter(r => r.registration_type === '打本报名').length
  const baiyeCount = registrations.filter(r => r.registration_type === '百业战报名').length
  const otherCount = registrations.filter(r => r.registration_type === '其他活动报名').length
  const totalCount = registrations.length

  return (
    <View className="min-h-full bg-gray-50 p-4 pb-20">
      {/* 标题区 */}
      <View className="mb-4">
        <Text className="block text-xl font-bold text-gray-900">活动报名</Text>
        <View className="flex flex-row gap-4 mt-1 flex-wrap">
          <Text className="block text-sm text-gray-500">
            打本报名 <Text className="text-indigo-500 font-semibold">{raidCount}</Text> 人
          </Text>
          <Text className="block text-sm text-gray-500">
            百业战报名 <Text className="text-orange-500 font-semibold">{baiyeCount}</Text> 人
          </Text>
          <Text className="block text-sm text-gray-500">
            其他活动 <Text className="text-emerald-500 font-semibold">{otherCount}</Text> 人
          </Text>
        </View>
      </View>

      {/* 报名表单区 */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">填写报名信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 报名类型 */}
          <View>
            <Label className="text-sm text-gray-700 mb-1 block">报名类型</Label>
            <Picker mode="selector" range={REGISTRATION_TYPE_OPTIONS.map(t => t.label)} value={registrationTypeIndex} onChange={handleRegistrationTypeChange}>
              <View className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between items-center">
                <Text className="text-gray-900">{REGISTRATION_TYPE_OPTIONS[registrationTypeIndex].label}</Text>
                <Text className="text-gray-400 text-sm">▼</Text>
              </View>
            </Picker>
          </View>

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

          {/* 活动日期/时间选择 */}
          {showDatePicker ? (
            <View>
              <Label className="text-sm text-gray-700 mb-1 block">活动日期</Label>
              <Picker mode="date" value={selectedDate} start={getTodayDate()} onChange={handleDateChange}>
                <View className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between items-center">
                  <Text className={selectedDate ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedDate || '请选择日期'}
                  </Text>
                  <Calendar size={18} color="#64748b" />
                </View>
              </Picker>
            </View>
          ) : showBaiyeOptions ? (
            <>
              <View>
                <Label className="text-sm text-gray-700 mb-1 block">活动时间</Label>
                <Picker mode="selector" range={BAIYE_TIME_OPTIONS.map(t => t.label)} value={baiyeTimeIndex} onChange={(e) => setBaiyeTimeIndex(Number(e.detail.value))}>
                  <View className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between items-center">
                    <Text className="text-gray-900">{BAIYE_TIME_OPTIONS[baiyeTimeIndex].label}</Text>
                    <Clock size={18} color="#64748b" />
                  </View>
                </Picker>
              </View>
              <View>
                <Label className="text-sm text-gray-700 mb-1 block">选择小队</Label>
                <Picker mode="selector" range={TEAM_OPTIONS.map(t => t.label)} value={teamIndex} onChange={(e) => setTeamIndex(Number(e.detail.value))}>
                  <View className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between items-center">
                    <Text className="text-gray-900">{TEAM_OPTIONS[teamIndex].label}</Text>
                    <Text className="text-gray-400 text-sm">▼</Text>
                  </View>
                </Picker>
              </View>
            </>
          ) : (
            <View>
              <Label className="text-sm text-gray-700 mb-1 block">活动日期</Label>
              <Picker mode="date" value={selectedDate} start={getTodayDate()} onChange={handleDateChange}>
                <View className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between items-center">
                  <Text className={selectedDate ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedDate || '请选择日期'}
                  </Text>
                  <Calendar size={18} color="#64748b" />
                </View>
              </Picker>
            </View>
          )}

          {/* 活动时段（仅打本报名显示） */}
          {showTimeSlotPicker && (
            <View>
              <Label className="text-sm text-gray-700 mb-1 block">活动时段</Label>
              <Picker mode="selector" range={RAID_TIME_SLOT_OPTIONS.map(t => t.label)} value={timeSlotIndex} onChange={handleTimeSlotChange}>
                <View className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between items-center">
                  <Text className="text-gray-900">{RAID_TIME_SLOT_OPTIONS[timeSlotIndex].label}</Text>
                  <Clock size={18} color="#64748b" />
                </View>
              </Picker>
            </View>
          )}

          {/* 是否为指挥 */}
          <View className="flex flex-row items-center justify-between py-2">
            <Label className="text-sm text-gray-700">是否为指挥</Label>
            <View 
              className={`w-12 h-7 rounded-full p-1 ${isCommander ? 'bg-indigo-500' : 'bg-gray-300'}`}
              onClick={() => setIsCommander(!isCommander)}
            >
              <View className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${isCommander ? 'translate-x-5' : 'translate-x-0'}`} />
            </View>
          </View>

          {/* 提交按钮 */}
          <Button
            className={`w-full text-white ${
              currentRegistrationType === '打本报名' ? 'bg-indigo-500 hover:bg-indigo-600' :
              currentRegistrationType === '百业战报名' ? 'bg-orange-500 hover:bg-orange-600' :
              'bg-emerald-500 hover:bg-emerald-600'
            }`}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '提交中...' : '立即报名'}
          </Button>
        </CardContent>
      </Card>

      {/* 打本报名分组结果区 */}
      {Object.keys(groupedData).length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <View className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center">
                <Users size={18} color="#6366f1" className="mr-2" />
                打本报名分组
              </CardTitle>
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={handleExportExcel}
                disabled={exporting}
              >
                <Download size={14} color="#ffffff" className="mr-1" />
                <Text className="text-white text-xs">{exporting ? '导出中...' : '导出Excel'}</Text>
              </Button>
            </View>
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
                  
                  {Object.entries(groupsByNumber).map(([groupNum, groupMembers]) => {
                    // 计算该组霖霖数量
                    const linlinCount = groupMembers.filter(m => m.school === '霖霖').length
                    // 查找该组的警告
                    const groupWarning = warnings.find(w => 
                      w.raid_date === date && 
                      w.raid_time_slot === timeSlot && 
                      w.group_number === Number(groupNum)
                    )
                    
                    return (
                      <View key={groupNum} className="mb-2">
                        <View className="flex items-center gap-2 mb-1">
                          <Text className="text-sm font-medium text-gray-700">
                            第 {groupNum} 组 ({groupMembers.length}/10人)
                          </Text>
                          <Badge variant="outline" className={`text-xs ${linlinCount >= 2 ? 'bg-green-50 text-green-600 border-green-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                            霖霖×{linlinCount}
                          </Badge>
                        </View>
                        {groupWarning && (
                          <View className="bg-orange-50 border border-orange-200 rounded-md px-2 py-1 mb-1">
                            <Text className="text-xs text-orange-600">⚠️ {groupWarning.warning}</Text>
                          </View>
                        )}
                        <View className="bg-gray-50 rounded-lg p-2">
                          <View className="flex flex-wrap gap-2">
                            {groupMembers.map(member => (
                              <View 
                                key={member.id} 
                                className={`flex items-center gap-1 px-2 py-1 rounded-md ${member.school === '霖霖' ? 'bg-blue-100' : 'bg-white border border-gray-200'}`}
                              >
                                <Text className="text-xs text-gray-700">{member.player_id}</Text>
                                <Text className="text-xs text-gray-400">({member.school})</Text>
                                {member.is_commander && (
                                  <Badge className="bg-amber-100 text-amber-700 text-xs px-1">★指挥</Badge>
                                )}
                                <View onClick={() => handleDelete(member.id)} className="ml-1">
                                  <Trash2 size={14} color="#ef4444" />
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* 其他活动报名列表 */}
      {Object.keys(otherActivityData).length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center">
              <Users size={18} color="#10b981" className="mr-2" />
              其他活动报名
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(otherActivityData).map(([key, members]) => {
              const [date, timeSlot] = key.split('_')

              return (
                <View key={key} className="mb-4 last:mb-0">
                  <View className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                      {date} {timeSlot}
                    </Badge>
                    <Text className="text-xs text-gray-500">共 {members.length} 人</Text>
                  </View>
                  
                  <View className="bg-gray-50 rounded-lg p-2">
                    <View className="flex flex-wrap gap-2">
                      {members.map(member => (
                        <View 
                          key={member.id} 
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-gray-200"
                        >
                          <Text className="text-xs text-gray-700">{member.player_id}</Text>
                          <Text className="text-xs text-gray-400">({member.school})</Text>
                          {member.is_commander && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs px-1">★指挥</Badge>
                          )}
                          <View onClick={() => handleDelete(member.id)} className="ml-1">
                            <Trash2 size={14} color="#ef4444" />
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* 百业战报名分组结果区 */}
      {Object.keys(baiyeData).length > 0 && (
        <Card className="mb-4 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center">
              <Users size={18} color="#f97316" className="mr-2" />
              百业战报名
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(baiyeData).map(([key, members]) => {
              const [date, team] = key.split('_')
              
              return (
                <View key={key} className="mb-4 last:mb-0">
                  <View className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
                      {date}
                    </Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                      {team}
                    </Badge>
                    <Text className="text-xs text-gray-500">共 {members.length} 人</Text>
                  </View>
                  
                  <View className="bg-gray-50 rounded-lg p-3">
                    {members.map((member, idx) => (
                      <View key={member.id} className={`flex flex-row items-center justify-between py-2 ${idx < members.length - 1 ? 'border-b border-gray-100' : ''}`}>
                        <View className="flex flex-row items-center gap-2">
                          <Text className="text-sm text-gray-900">{member.player_id}</Text>
                          <Badge variant="outline" className={`text-xs ${member.school === '霖霖' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'}`}>
                            {member.school}
                          </Badge>
                          {member.is_commander && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">指挥</Badge>
                          )}
                        </View>
                        <View onClick={() => handleDelete(member.id)}>
                          <Trash2 size={16} color="#ef4444" />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* 空状态 */}
      {totalCount === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Text className="text-gray-400">暂无报名记录</Text>
          </CardContent>
        </Card>
      )}
    </View>
  )
}
