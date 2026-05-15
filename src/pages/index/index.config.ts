export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '打本报名' })
  : { navigationBarTitleText: '打本报名' }
