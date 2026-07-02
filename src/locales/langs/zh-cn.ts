const local: App.I18n.Schema = {
  system: {
    title: 'DevOps SoyAdmin',
    updateTitle: '系统版本更新通知',
    updateContent: '检测到系统有新版本发布，是否立即刷新页面？',
    updateConfirm: '立即刷新',
    updateCancel: '稍后再说'
  },
  common: {
    action: '操作',
    add: '新增',
    addSuccess: '添加成功',
    backToHome: '返回首页',
    batchDelete: '批量删除',
    import: '导入',
    export: '导出',
    importSuccess: '导入成功',
    importFail: '导入失败',
    importTemplate: '导入模板',
    downloadTemplate: '下载模板',
    importResult: '导入结果',
    importSize: '请上传大小不超过',
    importEnd: '的文件',
    importFormat: '且格式为',
    importTip: '请上传大小不超过',
    selectFileFirst: '请先选择文件',
    exportSuccess: '导出成功',
    exportFail: '导出失败',
    updateFail: '更新失败',
    updateExisting: '是否更新已经存在的数据',
    cancel: '取消',
    close: '关闭',
    check: '勾选',
    expandColumn: '展开列',
    columnSetting: '列设置',
    config: '配置',
    login: '登录',
    confirm: '确认',
    save: '保存',
    delete: '删除',
    deleteSuccess: '删除成功',
    confirmDelete: '确认删除吗？',
    edit: '编辑',
    download: '下载',
    warning: '警告',
    error: '错误',
    serverShutdown: '服务器正在关闭，请保存数据',
    index: '序号',
    keywordSearch: '请输入关键词搜索',
    logout: '退出登录',
    logoutConfirm: '确认退出登录吗？',
    lookForward: '敬请期待',
    modify: '修改',
    modifySuccess: '修改成功',
    noData: '无数据',
    operate: '操作',
    pleaseCheckValue: '请检查输入的值是否合法',
    refresh: '刷新',
    reset: '重置',
    search: '搜索',
    switch: '切换',
    tip: '提示',
    trigger: '触发',
    update: '更新',
    saveSuccess: '保存成功',
    updateSuccess: '更新成功',
    noChange: '没有进行任何操作',
    userCenter: '个人中心',
    switchRole: '切换角色',
    detail: '详情',
    clear: '清空',
    copySuccess: '复制成功',
    copyFail: '复制失败',
    startDate: '开始日期',
    endDate: '结束日期',
    pleaseInput: '请输入',
    pleaseSelect: '请选择',
    yesOrNo: {
      yes: '是',
      no: '否'
    },
    second: '秒',
    selected: '已选择',
    anyRecords: '条记录',
    noSelectRecord: '未选中任何记录',
    retry: '重试',
    loadError: '加载失败'
  },
  request: {
    logout: '请求失败后登出用户',
    logoutMsg: '用户状态失效，请重新登录',
    logoutWithModal: '请求失败后弹出模态框再登出用户',
    logoutWithModalMsg: '用户状态失效，请重新登录',
    refreshToken: '请求的token已过期，刷新token',
    tokenExpired: 'token已过期',
    sessionExpired: '登录会话已过期，请重新登录'
  },
  theme: {
    themeDrawerTitle: '主题配置',
    tabs: {
      appearance: '外观',
      layout: '布局',
      general: '通用',
      preset: '预设'
    },
    appearance: {
      themeSchema: {
        title: '主题模式',
        light: '亮色模式',
        dark: '暗黑模式',
        auto: '跟随系统'
      },
      grayscale: '灰色模式',
      colourWeakness: '色弱模式',
      themeColor: {
        title: '主题颜色',
        primary: '主色',
        info: '信息色',
        success: '成功色',
        warning: '警告色',
        error: '错误色',
        followPrimary: '跟随主色'
      },
      themeRadius: {
        title: '主题圆角'
      },
      recommendColor: '应用推荐算法的颜色',
      recommendColorDesc: '推荐颜色的算法参照',
      preset: {
        title: '主题预设',
        apply: '应用',
        applySuccess: '预设应用成功',
        default: {
          name: '默认预设',
          desc: '系统默认主题预设'
        },
        soybean: {
          name: 'Soybean',
          desc: 'Soybean 默认主题预设'
        },
        dark: {
          name: '暗色预设',
          desc: '适用于夜间使用的暗色主题预设'
        },
        compact: {
          name: '紧凑型',
          desc: '适用于小屏幕的紧凑布局预设'
        },
        azir: {
          name: 'Azir的预设',
          desc: '是 Azir 比较喜欢的莫兰迪色系冷淡风'
        }
      }
    },
    layout: {
      layoutMode: {
        title: '布局模式',
        vertical: '左侧菜单模式',
        'vertical-mix': '左侧菜单混合模式',
        'vertical-hybrid-header-first': '左侧混合-顶部优先',
        horizontal: '顶部菜单模式',
        'top-hybrid-sidebar-first': '顶部混合-侧边优先',
        'top-hybrid-header-first': '顶部混合-顶部优先',
        vertical_detail: '左侧菜单布局，菜单在左，内容在右。',
        'vertical-mix_detail': '左侧双菜单布局，一级菜单在左侧深色区域，二级菜单在左侧浅色区域。',
        'vertical-hybrid-header-first_detail':
          '左侧混合布局，一级菜单在顶部，二级菜单在左侧深色区域，三级菜单在左侧浅色区域。',
        horizontal_detail: '顶部菜单布局，菜单在顶部，内容在下方。',
        'top-hybrid-sidebar-first_detail': '顶部混合布局，一级菜单在左侧，二级菜单在顶部。',
        'top-hybrid-header-first_detail': '顶部混合布局，一级菜单在顶部，二级菜单在左侧。'
      },
      tab: {
        title: '标签栏设置',
        visible: '显示标签栏',
        cache: '标签栏信息缓存',
        cacheTip: '离开页面后仍然保留标签栏信息',
        height: '标签栏高度',
        mode: {
          title: '标签栏风格',
          slider: '滑块风格',
          chrome: '谷歌风格',
          button: '按钮风格'
        },
        closeByMiddleClick: '鼠标中键关闭标签页',
        closeByMiddleClickTip: '启用后可以使用鼠标中键点击标签页进行关闭'
      },
      header: {
        title: '头部设置',
        height: '头部高度',
        breadcrumb: {
          visible: '显示面包屑',
          showIcon: '显示面包屑图标'
        }
      },
      sider: {
        title: '侧边栏设置',
        inverted: '深色侧边栏',
        width: '侧边栏宽度',
        collapsedWidth: '侧边栏折叠宽度',
        mixWidth: '混合布局侧边栏宽度',
        mixCollapsedWidth: '混合布局侧边栏折叠宽度',
        mixChildMenuWidth: '混合布局子菜单宽度',
        autoSelectFirstMenu: '自动选择第一个子菜单',
        autoSelectFirstMenuTip: '点击一级菜单时，自动选择并导航到第一个子菜单的最深层级'
      },
      footer: {
        title: '底部设置',
        visible: '显示底部',
        fixed: '固定底部',
        height: '底部高度',
        right: '底部居右'
      },
      content: {
        title: '内容区域设置',
        scrollMode: {
          title: '滚动模式',
          tip: '主题滚动仅 main 部分滚动，外层滚动可携带头部底部一起滚动',
          wrapper: '外层滚动',
          content: '主体滚动'
        },
        page: {
          animate: '页面切换动画',
          mode: {
            title: '页面切换动画类型',
            'fade-slide': '滑动',
            fade: '淡入淡出',
            'fade-bottom': '底部消退',
            'fade-scale': '缩放消退',
            'zoom-fade': '渐变',
            'zoom-out': '闪现',
            none: '无'
          }
        },
        fixedHeaderAndTab: '固定头部和标签栏'
      }
    },
    general: {
      title: '通用设置',
      watermark: {
        title: '水印设置',
        visible: '显示全屏水印',
        text: '自定义水印文本',
        enableUserName: '启用用户名水印',
        enableTime: '显示当前时间',
        timeFormat: '时间格式'
      },
      multilingual: {
        title: '多语言设置',
        visible: '显示多语言按钮'
      },
      globalSearch: {
        title: '全局搜索设置',
        visible: '显示全局搜索按钮'
      }
    },
    configOperation: {
      copyConfig: '复制配置',
      copySuccessMsg: '复制成功，请替换 src/theme/settings.ts 中的变量 themeSettings',
      resetConfig: '重置配置',
      resetSuccessMsg: '重置成功'
    },
    tablePropsTitle: '表格配置',
    table: {
      size: {
        title: '表格大小',
        small: '小',
        medium: '中',
        large: '大'
      },
      bordered: '边框',
      bottomBordered: '底部边框',
      singleColumn: '设定行的分割线',
      singleLine: '设定列的分割线',
      striped: '斑马线条纹'
    }
  },
  route: {
    login: '登录',
    403: '无权限',
    404: '页面不存在',
    500: '服务器错误',
    'iframe-page': '外链页面',
    admin: '首页',
    disk: '网盘',
    server: '服务器管理',
    server_dashboard: '概览',
    server_monitor: '监控大屏',
    'server_server-list': '服务器管理',
    'server_server-detail': '服务器详情',
    server_container: '容器管理',
    server_database: '数据库管理',
    'server_database-detail': '数据库详情',
    init: '初始化',
    spread: '分享',
    about: '关于',
    'share-access': '文件分享',
    'user-center': '个人中心',
    'adminUserCenter': '个人中心',
    'diskUserCenter': '个人中心',
    'notice-user': '公告查看',
    'adminNoticeUser': '公告查看',
    'diskNoticeUser': '公告查看',
    log: '日志中心',
    log_login: '登录日志',
    log_operation: '操作日志',
    log_file: '文件操作日志',
    log_operate: '操作日志',
    system: '系统管理',
    system_user: '用户管理',
    system_role: '角色管理',
    system_menu: '菜单管理',
    system_dept: '部门管理',
    system_post: '岗位管理',
    system_dict: '字典管理',
    system_notice: '通知公告',
    system_setting: '系统设置',
    recent: '最近访问',
    favorite: '我的收藏',
    share: '我的分享',
    trash: '回收站',
    manage: '系统管理',
    manage_dept: '部门管理',
    manage_dict: '字典管理',
    manage_log: '日志中心',
    manage_log_login: '登录日志',
    manage_log_operation: '操作日志',
    manage_menu: '菜单管理',
    manage_post: '岗位管理',
    manage_role: '角色管理',
    manage_settings: '项目设置',
    manage_storage: '存储管理',
    manage_user: '用户管理',
    manage_notice: '通知公告',
    'my-share': '我的分享',
    'shared-with-me': '共享给我',
    'group-share': '群组共享'
  },
  menu: {
    root: '根目录',
    system_tenant: '租户管理',
    system_log: '日志中心',
    'monitor_snail-job': '任务调度中心',
    monitor_admin: 'Admin 监控'
  },
  dict: {
    sys_user_sex: {
      male: '男',
      female: '女',
      unknown: '未知'
    },
    sys_show_hide: {
      show: '显示',
      hide: '隐藏'
    },
    sys_normal_disable: {
      normal: '正常',
      disable: '停用'
    },
    sys_yes_no: {
      yes: '是',
      no: '否'
    },
    sys_notice_type: {
      notice: '通知',
      announcement: '公告'
    },
    sys_notice_status: {
      normal: '正常',
      close: '关闭'
    },
    sys_oper_type: {
      insert: '新增',
      update: '修改',
      delete: '删除',
      grant: '授权',
      export: '导出',
      import: '导入',
      force: '强退',
      gencode: '生成代码',
      clean: '清空数据',
      other: '其他'
    },
    sys_common_status: {
      success: '成功',
      fail: '失败'
    },
    sys_grant_type: {
      password: '密码认证',
      sms: '短信认证',
      email: '邮件认证',
      miniapp: '小程序认证',
      social: '三方登录认证'
    },
    sys_device_type: {
      pc: 'PC',
      android: '安卓',
      ios: 'iOS',
      miniapp: '小程序'
    },
    wf_business_status: {
      revoked: '已撤销',
      draft: '草稿',
      pending: '待审核',
      completed: '已完成',
      cancelled: '已作废',
      returned: '已退回',
      terminated: '已终止'
    },
    wf_form_type: {
      custom_form: '自定义表单',
      dynamic_form: '动态表单'
    },
    wf_task_status: {
      revoke: '撤销',
      pass: '通过',
      pending_review: '待审核',
      cancel: '作废',
      return: '退回',
      terminate: '终止',
      transfer: '转办',
      delegate: '委托',
      copy: '抄送',
      add_sign: '加签',
      minus_sign: '减签',
      timeout: '超时'
    }
  },
  modules: {
    admin: '系统模块',
    disk: '网盘模块'
  },
  page: {
    login: {
      common: {
        title: '现代化的企业级多租户管理系统',
        subTitle: '为开发者提供了完整的企业管理解决方案',
        loginOrRegister: '登录 / 注册',
        register: '注册',
        userNamePlaceholder: '请输入用户名',
        phonePlaceholder: '请输入手机号',
        codePlaceholder: '请输入验证码',
        passwordPlaceholder: '请输入密码',
        confirmPasswordPlaceholder: '请再次输入密码',
        codeLogin: '验证码登录',
        confirm: '确定',
        back: '返回',
        validateSuccess: '验证成功',
        loginSuccess: '登录成功',
        welcomeBack: '欢迎回来，{userName} ！',
        sessionExpiredTitle: '会话过期',
        sessionExpiredContent: '您的登录会话已过期，请重新登录以继续操作'
      },
      pwdLogin: {
        title: '密码登录',
        rememberMe: '记住密码',
        forgetPassword: '忘记密码？',
        register: '注册账号',
        otherAccountLogin: '其他账号登录',
        otherLoginMode: '其他登录方式',
        superAdmin: '超级管理员',
        admin: '管理员',
        user: '普通用户',
        thirdPartyLogin: '第三方登录',
        wecomLogin: '企业微信登录',
        wechatLogin: '微信登录',
        githubLogin: 'GitHub 登录',
        giteeLogin: 'Gitee 登录',
        featureNotImplemented: '该功能暂未实现'
      },
      codeLogin: {
        title: '验证码登录',
        getCode: '获取验证码',
        reGetCode: '{time}秒后重新获取',
        sendCodeSuccess: '验证码发送成功',
        imageCodePlaceholder: '请输入图片验证码'
      },
      register: {
        title: '注册账号',
        agreement: '我已经仔细阅读并接受',
        protocol: '《用户协议》',
        policy: '《隐私权政策》'
      },
      resetPwd: {
        title: '重置密码'
      },
      bindWeChat: {
        title: '绑定微信'
      },
      wecomLogin: {
        title: '企业微信登录',
        loading: '正在加载二维码...',
        scanTip: '请使用企业微信扫描二维码登录',
        appName: '「淳瀚云枢」',
        scanned: '已扫码，请在手机端确认登录',
        scannedConfirm: '已扫码，请在手机端确认登录',
        countdown: '二维码将于 {seconds} 秒后过期',
        expired: '二维码已过期，请点击刷新',
        refresh: '刷新二维码',
        backToLogin: '返回密码登录',
        qrCodeLoadFailed: '加载二维码失败，请稍后重试'
      }
    },
    home: {
      branchDesc:
        '为了方便大家开发和更新合并，我们对main分支的代码进行了精简，只保留了首页菜单，其余内容已移至example分支进行维护。预览地址显示的内容即为example分支的内容。',
      greeting: '早安，{userName}, 今天又是充满活力的一天!',
      weatherDesc: '今日多云转晴，20℃ - 25℃!',
      projectCount: '项目数',
      todo: '待办',
      message: '消息',
      downloadCount: '下载量',
      registerCount: '注册量',
      schedule: '作息安排',
      study: '学习',
      work: '工作',
      rest: '休息',
      entertainment: '娱乐',
      visitCount: '访问量',
      turnover: '成交额',
      dealCount: '成交量',
      projectNews: {
        title: '项目动态',
        moreNews: '更多动态',
        desc1: 'Soybean 在2021年5月28日创建了开源项目 soybean-admin!',
        desc2: 'Yanbowe 向 soybean-admin 提交了一个bug，多标签栏不会自适应。',
        desc3: 'Soybean 准备为 soybean-admin 的发布做充分的准备工作!',
        desc4: 'Soybean 正在忙于为soybean-admin写项目说明文档！',
        desc5: 'Soybean 刚才把工作台页面随便写了一些，凑合能看了！'
      },
      creativity: '创意'
    },
    admin: {
      branchDesc:
        '为了方便大家开发和更新合并，我们对main分支的代码进行了精简，只保留了首页菜单，其余内容已移至example分支进行维护。预览地址显示的内容即为example分支的内容。',
      greeting: '早安，{userName}, 今天又是充满活力的一天!',
      weatherDesc: '今日多云转晴，20℃ - 25℃!',
      projectCount: '项目数',
      todo: '待办',
      message: '消息',
      downloadCount: '下载量',
      registerCount: '注册量',
      schedule: '作息安排',
      study: '学习',
      work: '工作',
      rest: '休息',
      entertainment: '娱乐',
      visitCount: '访问量',
      turnover: '成交额',
      dealCount: '成交量',
      projectNews: {
        title: '项目动态',
        moreNews: '更多动态',
        desc1: 'Soybean 在2021年5月28日创建了开源项目 soybean-admin!',
        desc2: 'Yanbowe 向 soybean-admin 提交了一个bug，多标签栏不会自适应。',
        desc3: 'Soybean 准备为 soybean-admin 的发布做充分的准备工作!',
        desc4: 'Soybean 正在忙于为soybean-admin写项目说明文档！',
        desc5: 'Soybean 刚才把工作台页面随便写了一些，凑合能看了！'
      },
      creativity: '创意'
    },
    common: {
      id: 'ID',
      createBy: '创建者',
      createTime: '创建时间',
      updateBy: '更新者',
      updateTime: '更新时间',
      remark: '备注',
      form: {
        remark: {
          required: '请输入备注',
          invalid: '备注不能为空'
        }
      }
    },
    system: {
      client: {
        title: '客户端列表',
        clientId: '客户端 ID',
        clientKey: '客户端 Key',
        clientSecret: '客户端秘钥',
        grantTypeList: '授权类型',
        deviceType: '设备类型',
        activeTimeout: 'Token 活跃超时时间',
        timeout: 'Token 固定超时',
        status: '状态',
        form: {
          clientId: {
            required: '请输入客户端 ID',
            invalid: '客户端 ID 不能为空'
          },
          clientKey: {
            required: '请输入客户端 Key',
            invalid: '客户端 Key 不能为空'
          },
          clientSecret: {
            required: '请输入客户端秘钥',
            invalid: '客户端秘钥不能为空'
          },
          grantTypeList: {
            required: '请选择授权类型',
            invalid: '授权类型不能为空'
          },
          deviceType: {
            required: '请选择设备类型',
            invalid: '设备类型不能为空'
          },
          activeTimeout: {
            required: '请输入 Token 活跃超时时间',
            invalid: 'Token 活跃超时时间不能为空',
            tooltip: '指定时间无操作则过期(单位：秒), 默认30分钟(1800秒)'
          },
          timeout: {
            required: '请输入 Token 固定超时',
            invalid: 'Token 固定超时不能为空',
            tooltip: '指定时间必定过期(单位：秒)，默认七天(604800秒)'
          },
          status: {
            required: '请选择状态',
            invalid: '状态不能为空'
          }
        },
        addClient: '新增客户端',
        editClient: '编辑客户端'
      },
      config: {
        title: '参数配置列表',
        configName: '参数名称',
        configKey: '参数键名',
        configValue: '参数键值',
        configType: '是否内置',
        remark: '备注',
        createTime: '创建时间',
        refreshCache: '刷新缓存',
        refreshCacheSuccess: '刷新缓存成功',
        form: {
          configId: {
            required: '请输入参数主键',
            invalid: '参数主键不能为空'
          },
          configName: {
            required: '请输入参数名称',
            invalid: '参数名称不能为空'
          },
          configKey: {
            required: '请输入参数键名',
            invalid: '参数键名不能为空'
          },
          configValue: {
            required: '请输入参数键值',
            invalid: '参数键值不能为空'
          },
          configType: {
            required: '请选择是否内置',
            invalid: '是否内置不能为空'
          },
          remark: {
            required: '请输入备注',
            invalid: '备注不能为空'
          }
        },
        addConfig: '新增参数配置',
        editConfig: '编辑参数配置'
      },
      dept: {
        empty: '暂无部门信息',
        title: '部门列表',
        parentId: '上级部门',
        deptName: '部门名称',
        orderNum: '排序',
        deptCategory: '类别编码',
        leader: '负责人',
        phone: '联系电话',
        email: '邮箱',
        status: '状态',
        sort: '排序',
        createTime: '创建时间',
        expandAll: '全部展开',
        collapseAll: '全部收起',
        form: {
          parentId: {
            required: '请选择上级部门',
            invalid: '上级部门不能为空'
          },
          deptName: {
            required: '请输入部门名称',
            invalid: '部门名称不能为空'
          },
          orderNum: {
            required: '请输入排序',
            invalid: '排序不能为空'
          },
          deptCategory: {
            required: '请输入类别编码',
            invalid: '类别编码不能为空'
          },
          leader: {
            required: '请输入负责人',
            invalid: '负责人不能为空'
          },
          phone: {
            required: '请输入联系电话',
            invalid: '联系电话不能为空'
          },
          email: {
            required: '请输入邮箱',
            invalid: '邮箱不能为空'
          },
          status: {
            required: '请选择状态',
            invalid: '状态不能为空'
          },
          sort: {
            required: '请输入排序',
            invalid: '排序不能为空'
          },
          deptId: {
            required: '请输入部门id',
            invalid: '部门id不能为空'
          }
        },
        error: {
          getDeptDataFail: '获取部门用户数据失败',
          getDeptUserDataFail: '获取部门用户数据失败'
        },
        placeholder: {
          defaultLeaderPlaceHolder: '请选择负责人',
          addDataLeaderPlaceHolder: '仅在更新时可选择部门负责人',
          deptUserIsEmptyLeaderPlaceHolder: '该部门没有负责人'
        },
        addDept: '新增部门',
        editDept: '编辑部门'
      },
      dict: {
        title: '字典列表',
        dictTypeTitle: '字典类型列表',
        dictName: '字典名称',
        dictType: '字典类型',
        status: '状态',
        remark: '备注',
        createTime: '创建时间',
        refreshCacheSuccess: '刷新缓存成功',
        refreshCache: '刷新缓存',
        confirmDeleteDictType: '确定删除字典类型',
        data: {
          title: '字典数据列表',
          label: '字典标签',
          value: '字典键值',
          dictSort: '字典排序',
          isDefault: '是否默认',
          listClass: '标签样式',
          cssClass: 'CSS样式',
          status: '状态',
          remark: '备注',
          createTime: '创建时间'
        },
        form: {
          dictId: {
            required: '请输入字典主键',
            invalid: '字典主键不能为空'
          },
          dictCode: {
            required: '请输入字典编码',
            invalid: '字典编码不能为空'
          },
          dictName: {
            required: '请输入字典名称',
            invalid: '字典名称不能为空'
          },
          dictType: {
            required: '请输入字典类型',
            invalid: '字典类型不能为空'
          },
          status: {
            required: '请选择状态',
            invalid: '状态不能为空'
          },
          remark: {
            required: '请输入备注',
            invalid: '备注不能为空'
          },
          dictLabel: {
            required: '请输入字典标签',
            invalid: '字典标签不能为空'
          },
          dictValue: {
            required: '请输入字典键值',
            invalid: '字典键值不能为空'
          },
          dictSort: {
            required: '请输入字典排序',
            invalid: '字典排序不能为空'
          },
          isDefault: {
            required: '请选择是否默认',
            invalid: '是否默认不能为空'
          },
          listClass: {
            required: '请选择回显样式',
            invalid: '回显样式不能为空'
          },
          cssClass: {
            required: '请输入样式属性（其他样式扩展）',
            invalid: 'CSS样式不能为空'
          }
        },
        addDict: '新增字典',
        editDict: '编辑字典',
        addDictData: '新增字典数据',
        editDictData: '编辑字典数据',
        addDictType: '新增字典类型',
        editDictType: '编辑字典类型',
        exportDictType: '导出字典类型',
        refreshDictType: '刷新列表',
        dictTypeIsEmpty: '暂无字典类型'
      },
      menu: {
        title: '菜单列表',
        parentId: '上级菜单',
        iconType: '图标类型',
        menuName: '菜单名称',
        icon: '菜单图标',
        orderNum: '排序',
        perms: '权限字符',
        component: '组件路径',
        path: '路由地址',
        layout: '布局方式',
        externalPath: '外链地址',
        query: '路由参数',
        iframeQuery: 'iframe 地址',
        isFrame: '是否外链',
        isCache: '是否缓存',
        menuType: '菜单类型',
        visible: '显示状态',
        status: '菜单状态',
        createTime: '创建时间',
        cache: '缓存',
        noCache: '不缓存',
        rootName: '根目录',
        buttonPermissionList: '按钮权限列表',
        addButton: '新增按钮',
        editButton: '编辑按钮',
        deleteButton: '删除按钮',
        confirmDeleteButton: '确定删除该按钮权限吗？',
        buttonLabel: '按钮名称',
        buttonCode: '按钮编码',
        sortSuccess: '排序更新成功',
        sortFailed: '排序更新失败',
        moduleAssociation: '所属模块',
        selectModule: '请选择模块',
        dragSortTip: '拖拽可调整菜单顺序',
        dragInsideDisabled: '不支持拖拽到节点内部',
        dragCrossLevelDisabled: '不支持跨层级拖拽',
        emptyMenu: '暂无菜单',
        menuDetail: '菜单详情',
        cascadeDeleteContent: '级联删除菜单将删除所选中的菜单，是否继续？',
        iconifyTip: 'iconify 地址：https://icones.js.org',
        isFrameTip: '选择是外链则路由地址需要以`http(s)://`开头',
        isCacheTip: '选择是则会被`keep-alive`缓存，需要匹配组件的`name`和地址保持一致',
        visibleTip: '选择隐藏则路由将不会出现在侧边栏，但仍然可以访问',
        statusTip: '选择停用则路由将不会出现在侧边栏，也不能被访问',
        permsTip: "控制器中定义的权限字符，如：`{'@'}SaCheckPermission('system:user:list')`",
        componentTip: '访问的组件路径，如：`system/user/index`，默认在`views`目录下',
        pathTip: '访问的路由地址，如：`user`，如外网地址需内链访问则以`http(s)://`开头',
        layoutTip: '默认布局：具有公共部分的布局，如全局头部、侧边栏、底部等\n空白布局：无公共部分的布局，如登录页',
        form: {
          parentId: {
            required: '请选择上级菜单',
            invalid: '上级菜单不能为空'
          },
          menuType: {
            required: '请选择菜单类型',
            invalid: '菜单类型不能为空'
          },
          menuIds: {
            required: '请选择菜单',
            invalid: '菜单不能为空'
          },
          icon: {
            required: '请选择菜单图标',
            invalid: '菜单图标不能为空'
          },
          menuName: {
            required: '请输入菜单名称',
            invalid: '菜单名称不能为空'
          },
          orderNum: {
            required: '请输入排序',
            invalid: '排序不能为空'
          },
          perms: {
            required: '请输入权限字符',
            invalid: '权限字符不能为空'
          },
          isFrame: {
            required: '请选择是否外链',
            invalid: '是否外链不能为空'
          },
          path: {
            required: '请输入路由地址',
            invalid: '路由地址不能为空'
          },
          component: {
            required: '请输入组件路径',
            invalid: '组件路径不能为空'
          },
          query: {
            required: '请输入路由参数',
            invalid: '路由参数不能为空'
          },
          isCache: {
            required: '请选择是否缓存',
            invalid: '是否缓存不能为空'
          },
          visible: {
            required: '请选择显示状态',
            invalid: '显示状态不能为空'
          },
          status: {
            required: '请选择菜单状态',
            invalid: '菜单状态不能为空'
          },
          permission: {
            required: '请输入权限标识',
            invalid: '权限标识不能为空'
          },
          buttonLabel: {
            required: '请输入按钮名称',
            invalid: '按钮名称不能为空'
          },
          buttonCode: {
            required: '请输入按钮编码',
            invalid: '按钮编码不能为空'
          }
        },
        placeholder: {
          iconifyIconPlaceholder: '请输入图标',
          localIconPlaceholder: '请选择本地图标',
          queryKey: '请输入 Key',
          queryValue: '请输入 Value',
          queryIframe: '请输入 iframe 地址'
        },
        directory: '目录',
        menu: '菜单',
        button: '按钮',
        addMenu: '新增菜单',
        addChildMenu: '新增子菜单',
        editMenu: '编辑菜单',
        cascadeDelete: '级联删除菜单'
      },
      notice: {
        title: '通知公告列表',
        noticeTitle: '公告标题',
        noticeType: '公告类型',
        noticeContent: '公告内容',
        status: '状态',
        createTime: '创建时间',
        form: {
          noticeTitle: {
            required: '请输入公告标题',
            invalid: '公告标题不能为空'
          },
          noticeType: {
            required: '请选择公告类型',
            invalid: '公告类型不能为空'
          },
          noticeContent: {
            required: '请输入公告内容',
            invalid: '公告内容不能为空'
          },
          status: {
            required: '请选择状态',
            invalid: '状态不能为空'
          }
        },
        addNotice: '新增公告',
        editNotice: '编辑公告'
      },
      oss: {
        title: '文件列表',
        fileName: '文件名称',
        originalName: '原始名称',
        fileSuffix: '文件后缀',
        url: '文件地址',
        createTime: '创建时间',
        service: '服务商',
        form: {
          file: {
            required: '请选择文件',
            invalid: '文件不能为空'
          }
        },
        upload: '上传文件',
        preview: '预览',
        download: '下载',
        copy: '复制链接',
        copySuccess: '复制成功'
      },
      ossConfig: {
        title: 'OSS配置列表',
        configKey: '配置键',
        accessKey: 'accessKey',
        secretKey: 'secretKey',
        bucketName: '桶名称',
        prefix: '前缀',
        endpoint: '域名',
        domain: '自定义域名',
        isHttps: '是否https',
        region: '地域',
        status: '状态',
        remark: '备注',
        createTime: '创建时间',
        form: {
          configKey: {
            required: '请输入配置键',
            invalid: '配置键不能为空'
          },
          accessKey: {
            required: '请输入accessKey',
            invalid: 'accessKey不能为空'
          },
          secretKey: {
            required: '请输入secretKey',
            invalid: 'secretKey不能为空'
          },
          bucketName: {
            required: '请输入桶名称',
            invalid: '桶名称不能为空'
          },
          prefix: {
            required: '请输入前缀',
            invalid: '前缀不能为空'
          },
          endpoint: {
            required: '请输入域名',
            invalid: '域名不能为空'
          },
          domain: {
            required: '请输入自定义域名',
            invalid: '自定义域名不能为空'
          },
          isHttps: {
            required: '请选择是否https',
            invalid: '是否https不能为空'
          },
          region: {
            required: '请输入地域',
            invalid: '地域不能为空'
          },
          status: {
            required: '请选择状态',
            invalid: '状态不能为空'
          },
          remark: {
            required: '请输入备注',
            invalid: '备注不能为空'
          }
        },
        addOssConfig: '新增OSS配置',
        editOssConfig: '编辑OSS配置'
      },
      post: {
        title: '岗位列表',
        postCode: '岗位编码',
        postName: '岗位名称',
        postSort: '岗位排序',
        status: '状态',
        remark: '备注',
        createTime: '创建时间',
        form: {
          postCode: {
            required: '请输入岗位编码',
            invalid: '岗位编码不能为空'
          },
          postName: {
            required: '请输入岗位名称',
            invalid: '岗位名称不能为空'
          },
          postSort: {
            required: '请输入岗位排序',
            invalid: '岗位排序不能为空'
          },
          status: {
            required: '请选择状态',
            invalid: '状态不能为空'
          },
          remark: {
            required: '请输入备注',
            invalid: '备注不能为空'
          }
        },
        addPost: '新增岗位',
        editPost: '编辑岗位'
      },
      role: {
        title: '角色列表',
        roleName: '角色名称',
        roleKey: '权限字符',
        roleSort: '角色排序',
        status: '状态',
        remark: '备注',
        menuPermission: '菜单权限',
        dataScope: '数据权限',
        createTime: '创建时间',
        form: {
          roleName: {
            required: '请输入角色名称',
            invalid: '角色名称不能为空'
          },
          roleKey: {
            required: '请输入权限字符',
            invalid: '权限字符不能为空'
          },
          roleSort: {
            required: '请输入角色排序',
            invalid: '角色排序不能为空'
          },
          status: {
            required: '请选择状态',
            invalid: '状态不能为空'
          },
          remark: {
            required: '请输入备注',
            invalid: '备注不能为空'
          },
          menuIds: {
            required: '请选择菜单权限',
            invalid: '菜单权限不能为空'
          },
          deptIds: {
            required: '请选择部门权限',
            invalid: '部门权限不能为空'
          }
        },
        addRole: '新增角色',
        editRole: '编辑角色',
        configPermission: '分配权限',
        authorizedUsers: '分配用户',
        selectMenuPermission: '选择菜单权限',
        selectDataScope: '选择数据权限',
        selectDeptPermission: '选择部门权限'
      },
      tenant: {
        title: '租户列表',
        tenantName: '租户名称',
        tenantId: '租户编号',
        contactUserName: '联系人',
        contactPhone: '联系电话',
        companyName: '公司名称',
        licenseNumber: '营业执照编号',
        address: '地址',
        intro: '企业简介',
        domain: '域名',
        packageId: '租户套餐',
        expireTime: '过期时间',
        accountCount: '账号数量',
        status: '状态',
        createTime: '创建时间',
        form: {
          tenantName: {
            required: '请输入租户名称',
            invalid: '租户名称不能为空'
          },
          contactUserName: {
            required: '请输入联系人',
            invalid: '联系人不能为空'
          },
          contactPhone: {
            required: '请输入联系电话',
            invalid: '联系电话不能为空'
          },
          companyName: {
            required: '请输入公司名称',
            invalid: '公司名称不能为空'
          },
          licenseNumber: {
            required: '请输入营业执照编号',
            invalid: '营业执照编号不能为空'
          },
          address: {
            required: '请输入地址',
            invalid: '地址不能为空'
          },
          intro: {
            required: '请输入企业简介',
            invalid: '企业简介不能为空'
          },
          domain: {
            required: '请输入域名',
            invalid: '域名不能为空'
          },
          packageId: {
            required: '请选择租户套餐',
            invalid: '租户套餐不能为空'
          },
          expireTime: {
            required: '请选择过期时间',
            invalid: '过期时间不能为空'
          },
          accountCount: {
            required: '请输入账号数量',
            invalid: '账号数量不能为空'
          },
          status: {
            required: '请选择状态',
            invalid: '状态不能为空'
          }
        },
        addTenant: '新增租户',
        editTenant: '编辑租户'
      },
      tenantPackage: {
        title: '租户套餐列表',
        packageName: '套餐名称',
        menuIds: '菜单权限',
        remark: '备注',
        status: '状态',
        createTime: '创建时间',
        form: {
          packageName: {
            required: '请输入套餐名称',
            invalid: '套餐名称不能为空'
          },
          menuIds: {
            required: '请选择菜单权限',
            invalid: '菜单权限不能为空'
          },
          status: {
            required: '请选择状态',
            invalid: '状态不能为空'
          },
          remark: {
            required: '请输入备注',
            invalid: '备注不能为空'
          }
        },
        addTenantPackage: '新增租户套餐',
        editTenantPackage: '编辑租户套餐',
        statusChangeSuccess: '状态修改成功'
      },
      user: {
        title: '用户列表',
        userName: '用户名称',
        nickName: '用户昵称',
        deptName: '部门',
        phonenumber: '手机号码',
        status: '状态',
        createTime: '创建时间',
        password: '密码',
        confirmPassword: '确认密码',
        sex: '性别',
        roleIds: '角色',
        postIds: '岗位',
        email: '邮箱',
        avatar: '头像',
        remark: '备注',
        form: {
          userName: {
            required: '请输入用户名称',
            invalid: '用户名称不能为空'
          },
          nickName: {
            required: '请输入用户昵称',
            invalid: '用户昵称不能为空'
          },
          deptId: {
            required: '请选择部门',
            invalid: '部门不能为空'
          },
          phonenumber: {
            required: '请输入手机号码',
            invalid: '手机号码不能为空'
          },
          status: {
            required: '请选择状态',
            invalid: '状态不能为空'
          },
          password: {
            required: '请输入密码',
            invalid: '密码不能为空'
          },
          confirmPassword: {
            required: '请输入确认密码',
            invalid: '确认密码不能为空'
          },
          sex: {
            required: '请选择性别',
            invalid: '性别不能为空'
          },
          roleIds: {
            required: '请选择角色',
            invalid: '角色不能为空'
          },
          postIds: {
            required: '请选择岗位',
            invalid: '岗位不能为空'
          },
          email: {
            required: '请输入邮箱',
            invalid: '邮箱不能为空'
          },
          remark: {
            required: '请输入备注',
            invalid: '备注不能为空'
          }
        },
        addUser: '新增用户',
        editUser: '编辑用户',
        resetPassword: '重置密码',
        importUsers: '导入用户',
        exportTemplate: '导出模板',
        importSuccess: '导入成功',
        statusChangeSuccess: '状态修改成功'
      },
      operationLog: {
        pageTitle: '操作日志列表',
        title: '系统模块',
        businessType: '操作类型',
        method: '方法名称',
        requestMethod: '请求方式',
        operName: '操作人员',
        operIp: '操作IP',
        operLocation: '操作地点',
        costTime: '耗时',
        status: '状态',
        operTime: '操作时间',
        detail: '详情',
        clearConfirm: '确定清空所有操作日志吗？',
        clearSuccess: '清空成功',
        businessTypeOptions: {
          other: '其他',
          insert: '新增',
          update: '修改',
          delete: '删除',
          grant: '授权',
          export: '导出',
          import: '导入',
          force: '强退',
          genCode: '生成代码',
          clean: '清空数据'
        }
      },
      fileLog: {
        pageTitle: '文件操作日志列表',
        operationType: '操作类型',
        fileName: '文件名',
        filePath: '文件路径',
        targetFilePath: '目标路径',
        fileSize: '文件大小',
        operName: '操作人',
        operIp: '操作IP',
        operLocation: '操作地点',
        source: '来源',
        status: '状态',
        duration: '耗时',
        errorMessage: '错误信息',
        createdAt: '操作时间',
        clearConfirm: '确定清空所有文件操作日志吗？',
        clearSuccess: '清空成功',
        operationTypeOptions: {
          upload: '上传',
          download: '下载',
          preview: '预览',
          createFolder: '新建文件夹',
          delete: '删除',
          restore: '还原',
          purge: '彻底删除',
          rename: '重命名',
          move: '移动',
          copy: '复制',
          shareCreate: '创建分享',
          shareRevoke: '取消分享',
          favorite: '收藏',
          unfavorite: '取消收藏',
          permission: '权限变更'
        },
        statusOptions: {
          success: '成功',
          failed: '失败',
          partial: '部分'
        },
        sourceOptions: {
          web: '网页',
          shareLink: '分享链接',
          system: '系统'
        }
      },
      loginLog: {
        pageTitle: '登录日志列表',
        userName: '用户账号',
        deviceType: '设备类型',
        ipaddr: '登录IP',
        loginLocation: '登录地点',
        browser: '浏览器',
        os: '操作系统',
        status: '状态',
        msg: '提示消息',
        loginTime: '登录时间',
        detail: '详情',
        lock: '锁定',
        lockConfirm: '确定锁定该用户吗？',
        clearConfirm: '确定清空所有登录日志吗？',
        clearSuccess: '清空成功',
        lockSuccess: '锁定成功'
      }
    },
    about: {
      title: '关于',
      introduction: `RuoYi-Plus-Soybean 是一个现代化的企业级多租户管理系统，它结合了 RuoYi-Vue-Plus 的强大后端功能和 Soybean Admin 的现代化前端特性，为开发者提供了完整的企业管理解决方案。`,
      projectInfo: {
        title: '项目信息',
        version: '版本',
        latestBuildTime: '最新构建时间',
        documentLink: '文档地址',
        previewLink: '预览地址',
        repositoryLink: '仓库地址'
      },
      prdDep: '生产依赖',
      devDep: '开发依赖'
    },
    server: {
      dashboard: {
        title: '服务器概览',
        serverCount: '服务器',
        containerCount: '容器',
        databaseCount: '数据库',
        alertCount: '告警',
        resourceOverview: '资源总览',
        alertTrend: '告警趋势',
        recentAlerts: '最近告警',
        onlineServers: '在线服务器'
      },
      monitor: {
        title: '监控大屏',
        cpu: 'CPU',
        mem: '内存',
        disk: '磁盘',
        net: '网络流量',
        realtimeAlerts: '实时告警',
        alertTrend: '告警趋势',
        taskTrend: '任务趋势'
      },
      serverList: {
        title: '服务器管理',
        tableView: '表格视图',
        cardView: '卡片视图',
        name: '名称',
        ip: 'IP 地址',
        status: '状态',
        cpu: 'CPU',
        mem: '内存',
        disk: '磁盘',
        operations: '操作',
        online: '在线',
        offline: '离线',
        warning: '告警',
        detail: '详情',
        restart: '重启',
        console: '控制台',
        searchPlaceholder: '搜索名称 / IP'
      },
      serverDetail: {
        basicInfo: '基本信息',
        hostCredential: '主机凭证',
        realtimeMonitor: '实时监控',
        opLogs: '操作日志',
        metricRange1h: '近 1 小时',
        metricRange6h: '近 6 小时',
        metricRange24h: '近 24 小时',
        metricRange7d: '近 7 天',
        viewCredential: '查看凭证',
        copy: '复制',
        masked: '已脱敏',
        createdAt: '创建时间',
        cpuModel: 'CPU 型号',
        coreCount: '核心数',
        hostname: '主机名',
        os: '操作系统',
        uptime: '在线时长',
        location: '位置'
      }
    },
    disk: {
      title: '文件管理',
      fileType: {
        all: '全部',
        image: '图片',
        document: '文档',
        video: '视频',
        audio: '音频',
        other: '其它'
      },
      toolbar: {
        upload: '上传',
        uploadFile: '上传文件',
        uploadFolder: '上传文件夹',
        create: '新建',
        createFile: '新建文件',
        createFolder: '新建文件夹',
        search: '搜索',
        searchPlaceholder: '搜索我的文件',
        recentSearch: '最近搜索',
        share: '分享',
        batchShare: '批量分享',
        download: '下载',
        delete: '删除',
        rename: '重命名',
        more: '更多',
        move: '移动',
        copy: '复制',
        info: '详情',
        selectedCount: '已选择 {count} 个',
        transferList: '传输列表',
        sort: '排序',
        view: '视图',
        gridView: '网格视图',
        listView: '列表视图',
        refresh: '刷新列表'
      },
      sort: {
        nameAsc: '名称 A-Z',
        nameDesc: '名称 Z-A',
        sizeAsc: '大小 小到大',
        sizeDesc: '大小 大到小',
        timeAsc: '时间 旧到新',
        timeDesc: '时间 新到旧',
        typeAsc: '类型 文件优先',
        typeDesc: '类型 文件夹优先'
      },
      breadcrumb: {
        allFiles: '全部文件',
        loaded: '已全部加载',
        total: '共 {count} 个',
        back: '返回上一级'
      },
      file: {
        name: '名称',
        folder: '文件夹',
        size: '大小',
        type: '类型',
        path: '路径',
        createTime: '上传时间',
        modifyTime: '修改时间',
        noFiles: '暂无文件',
        empty: '还没有文件呢~',
        emptyWithType: '还没有{type}文件呢~',
        emptyUploadTip: '点击上方上传按钮添加文件',
        resolution: '尺寸',
        bitrate: '码率',
        frameRate: '帧率',
        format: '格式',
        duration: '时长'
      },
      transfer: {
        title: '传输列表',
        uploading: '上传中',
        downloading: '下载中',
        completed: '已完成',
        progress: '进度',
        speed: '速度',
        remaining: '剩余时间',
        status: {
          pending: '等待中',
          transferring: '传输中',
          completed: '已完成',
          failed: '失败',
          paused: '已暂停'
        },
        actions: {
          clearCompleted: '清空已完成',
          pauseAll: '全部暂停',
          resume: '继续',
          retry: '重试',
          cancel: '取消'
        }
      },
      createInline: {
        defaultFileName: '新建文件.txt',
        defaultFolderName: '新建文件夹',
        emptyName: '名称不能为空',
        nameExists: '当前目录下已存在"{name}"，继续创建将自动添加后缀编号。',
        confirmCreate: '继续创建',
        cancelCreate: '取消'
      },
      contextMenu: {
        open: '打开',
        download: '下载',
        share: '分享',
        copy: '复制',
        move: '移动',
        rename: '重命名',
        delete: '删除',
        detail: '详情',
        deleteConfirm: '确认删除该文件吗？',
        view: '查看',
        viewGrid: '网格模式',
        viewList: '列表模式',
        sortBy: '排序方式',
        sortName: '名称',
        sortSize: '大小',
        sortTime: '修改时间',
        refresh: '刷新',
        reload: '重新加载页面',
        addFavorite: '添加收藏',
        removeFavorite: '取消收藏',
        previewArchive: '预览',
        extractHere: '解压到当前目录',
        extractTo: '解压到...',
        extracting: '正在解压...',
        extractSuccess: '解压成功',
        extractFailed: '解压失败'
      },
      form: {
        folderName: {
          required: '请输入文件夹名称',
          invalid: '文件夹名称不能为空'
        }
      },
      createFolder: '新建文件夹',
      duplicateFile: {
        title: '文件名冲突',
        message: '当前目录下已存在同名文件「{fileName}」，请选择操作',
        folderConflictMessage: '文件夹「{folderName}」已存在，同名文件将被覆盖，是否继续？',
        overwrite: '覆盖',
        keepBoth: '保留两者'
      },
      uploadConflict: {
        title: '上传冲突处理',
        description: '检测到 {count} 个文件与目标目录中已有文件冲突，请选择处理方式：',
        keepBothAll: '全部保留两者',
        overwriteAll: '全部覆盖',
        skipAll: '全部跳过',
        skip: '跳过'
      },
      moveCopy: {
        copyTitle: '复制到',
        moveTitle: '移动到',
        sourceLabel: '已选文件',
        targetLabel: '目标路径',
        currentDir: '当前目录',
        noFolders: '暂无子文件夹',
        copySuccess: '复制成功',
        moveSuccess: '移动成功',
        renameSuccess: '重命名成功',
        renamePlaceholder: '请输入新名称',
        deleteConfirm: '确认删除',
        deleteSuccess: '删除成功'
      },
      extract: {
        title: '解压到',
        currentDir: '当前目录',
        noFolders: '暂无子文件夹',
        targetLabel: '目标路径',
        extracting: '解压中，请稍候...',
        success: '解压成功',
        failed: '解压失败'
      },
      detail: {
        title: '文件详情',
        fileName: '文件名称',
        fileType: '文件类型',
        fileSize: '文件大小',
        filePath: '文件位置',
        createTime: '上传时间',
        modifyTime: '修改时间',
        videoInfo: '视频信息',
        videoWidth: '宽度',
        videoHeight: '高度',
        videoBitrate: '码率',
        videoFrameRate: '帧率',
        videoFormat: '格式',
        videoDuration: '时长',
        audioInfo: '音频信息',
        audioSong: '歌曲名称',
        audioSinger: '歌手',
        audioAlbum: '专辑',
        imageInfo: '图片信息',
        imageResolution: '分辨率',
        imageCamera: '相机',
        imageDateTime: '拍摄时间',
        unknown: '未知'
      },
      share: {
        configTitle: '分享设置',
        validity: '有效期',
        shareType: '分享形式',
        publicLink: '公开链接',
        privateLink: '私密链接',
        extractionCode: '提取码',
        randomGenerate: '随机生成',
        customCode: '自定义',
        regenerate: '换一个',
        customAddress: '自定义地址',
        customAddressPlaceholder: '自定义分享地址',
        createShare: '创建分享',
        resultTitle: '分享创建成功',
        shareLink: '分享链接',
        copyExtractionCode: '复制提取码',
        copyShareText: '复制口令',
        cancelShare: '取消共享',
        cancelSuccess: '取消共享成功',
        close: '关闭',
        createSuccess: '分享链接已生成',
        shareTextTemplate: '我分享了一个文件给你，点击链接查看：{link} 提取码：{code}',
        forever: '永久',
        oneDay: '1天',
        sevenDays: '7天',
        thirtyDays: '30天',
        shareSuccess: '共享成功',
        linkShare: '链接分享',
        existingShareTip: '当前文件已有链接分享，请直接使用现有链接',
        codeFormat: '仅支持字母和数字，4-8位',
        addressFormat: '仅支持字母和数字，2-20位',
        linkPreview: '链接预览',
        selectUser: '选择用户',
        searchUser: '搜索用户',
        batchSet: '批量设置',
        all: '全部',
        user: '用户',
        remark: '备注',
        remarkPlaceholder: '请输入备注信息',
        selectDept: '选择部门',
        shareToUser: '共享给用户',
        shareToDept: '共享给部门',
        permissions: '权限配置',
        dept: '部门',
        sharedUsers: '已共享用户',
        sharedDepts: '已共享部门',
        noSharedUsers: '暂无共享用户',
        noSharedDepts: '暂无共享部门',
        addUser: '添加用户',
        // 新增：已有分享管理
        shareManagement: '分享管理',
        copyLink: '复制链接',
        copyCode: '复制口令',
        qrCode: '二维码',
        expireTime: '到期时间',
        operationPermissions: '操作权限',
        permEdit: '编辑',
        permDelete: '删除',
        permUpload: '上传',
        shareForm: '分享形式',
        shareFormPublic: '公开链接',
        shareFormPrivate: '私密链接',
        updateSuccess: '更新分享成功',
      },
      myShare: {
        title: '我的分享',
        fileName: '文件名',
        shareLink: '分享链接',
        createTime: '创建时间',
        shareType: '分享方式',
        expireTime: '过期时间',
        public: '公开',
        private: '私密',
        copyLink: '复制链接',
        cancelShare: '取消分享',
        cancelConfirm: '确认取消此分享？',
        cancelSuccess: '取消分享成功',
        noShare: '暂无分享记录',
        empty: '暂无分享记录',
        forever: '永久有效',
        expired: '已过期',
        viewCount: '访问',
        downloadCount: '下载'
      },
      groupShare: {
        empty: '暂无群组分享'
      },
      sharedWithMe: {
        empty: '暂无他人分享的文件',
        rootDirectory: '根目录',
        sharedBy: '分享者',
        permissions: '权限',
        size: '大小',
        shareTime: '分享时间',
        expireTime: '过期时间',
        permanent: '永久',
        back: '返回',
        accept: '接受',
        reject: '拒绝',
        pending: '待接受',
        acceptSuccess: '已接受共享',
        saveToDrive: '保存到我的网盘',
        saveToDriveSuccess: '已保存到我的网盘',
        saveSuccessRenamed: '因名称冲突，以下文件已自动重命名：{list}',
        itemsToSave: '要保存的文件',
        selectTargetFolder: '选择目标文件夹',
        source: '来源',
        refresh: '刷新',
        needAcceptFirst: '请先接受共享后再预览或打开',
        noPreviewPermission: '没有预览权限，请联系分享者授权',
        noUploadPermission: '没有上传权限，请联系分享者授权',
        searchPlaceholder: '搜索共享文件',
        searchFolderPlaceholder: '搜索文件夹',
        from: '来自',
        folderEmpty: '文件夹为空',
        previewNotSupported: '暂不支持预览此类型文件',
        downloadFailed: '下载失败，请稍后重试',
        selectedCount: '已选中 {count} 项',
        fileType: '文件类型',
        receiveStatus: '接收状态',
        role: '角色',
        roleViewer: '只读',
        roleEditor: '可读写',
        roleOwner: '所有者',
        permHintViewer: '可查看和下载文件',
        permHintEditor: '可查看、下载、上传、编辑和删除文件',
        saveAsIndependentCopy: '保存为独立副本：与源文件互不影响',
        permDownload: '下载',
        permDelete: '删除',
        permShare: '分享',
        image: '图片',
        video: '视频',
        audio: '音频',
        document: '文档',
        accepted: '已接受',
        fileName: '文件名',
        modifyTime: '修改时间',
        unknownArtist: '未知歌手',
        closeCurrentVideo: '请先关闭当前播放的视频',
        backToShareList: '返回共享列表',
        newShareTitle: '收到新共享',
        newShareContent: '{user} 向你共享了文件 "{file}"，请点击接受后查看',
        viewNow: '立即查看',
        upload: '上传',
        newFolder: '新建文件夹',
        uploadSuccess: '上传成功',
        createFolderSuccess: '文件夹创建成功',
        folderNamePlaceholder: '请输入文件夹名称',
        batchSaveToDrive: '批量保存到网盘',
        shareCancelled: '{user} 取消了文件共享'
      },
      recent: {
        title: '最近访问',
        remove: '移除记录',
        clearAll: '清空全部',
        empty: '暂无最近访问的文件'
      },
      trash: {
        title: '回收站',
        restore: '恢复',
        deletePermanently: '彻底删除',
        empty: '清空回收站',
        moveToTrash: '移至回收站',
        moveToTrashSuccess: '已移至回收站',
        deletePermanentlySuccess: '已彻底删除',
        permanentDeleteWarning: '彻底删除不可撤销，文件将无法恢复，确定继续？',
        permanentDeleteConfirmSingle: '此操作不可撤销，确定彻底删除此文件？',
        permanentDeleteConfirmMultiple: '此操作不可撤销，确定彻底删除 {count} 个文件？',
        restoreConfirmSingle: '确定将此文件恢复到原位置？',
        restoreConfirmMultiple: '确定将 {count} 个文件恢复到原位置？',
        restoreSuccess: '文件已恢复',
        emptyConfirm: '此操作不可撤销，确定清空回收站？',
        emptySuccess: '回收站已清空',
        cannotDownload: '回收站文件无法下载',
        noData: '回收站是空的',
        movingToTrash: '正在移至回收站 {count} 个文件…',
        restoring: '正在恢复 {count} 个文件…',
        deletingPermanently: '正在彻底删除 {count} 个文件…',
        emptying: '正在清空回收站…'
      },
      favorite: {
        title: '我的收藏',
        add: '添加收藏',
        remove: '取消收藏',
        removeConfirmSingle: '确定取消收藏此文件？',
        removeConfirmMultiple: '确定取消收藏 {count} 个文件？',
        removeSuccess: '已取消收藏',
        removeFailed: '取消收藏失败',
        downloadNotReady: '下载功能开发中',
        empty: '暂无收藏的文件'
      }
    },
    share: {
      verifyTitle: '请输入提取码',
      sharer: '分享者',
      inputExtractionCode: '请输入4位提取码以访问文件',
      extractionCodePlaceholder: '输入提取码',
      verifyAndAccess: '验证并访问',
      verifyTip: '提取码由分享者提供，请联系分享者获取',
      forever: '永久有效',
      expire: '有效期',
      viewCount: '访问次数',
      downloadCount: '下载次数',
      previewNotAllowed: '分享文件不支持预览，请下载后查看',
      previewNotAllowedTip: '分享文件不支持预览，请下载后查看',
      folderDownloadTip: '文件夹不支持单独下载，请使用打包下载',
      noFiles: '暂无文件',
      folder: '文件夹',
      downloadAll: '打包下载全部文件',
      shareExpired: '分享已失效',
      shareExpiredTip: '此分享链接不存在或已过期，请联系分享者获取新的分享链接',
      goHome: '返回首页',
      loginMyDisk: '登录我的网盘'
    }
  },
  form: {
    required: '不能为空',
    userName: {
      required: '请输入用户名',
      invalid: '用户名格式不正确'
    },
    phone: {
      required: '请输入手机号',
      invalid: '手机号格式不正确'
    },
    pwd: {
      required: '请输入密码',
      invalid: '密码至少8位，需包含字母、数字和特殊字符'
    },
    confirmPwd: {
      required: '请输入确认密码',
      invalid: '两次输入密码不一致'
    },
    code: {
      required: '请输入验证码',
      invalid: '验证码格式不正确'
    },
    email: {
      required: '请输入邮箱',
      invalid: '邮箱格式不正确'
    }
  },
  dropdown: {
    closeCurrent: '关闭',
    closeOther: '关闭其它',
    closeLeft: '关闭左侧',
    closeRight: '关闭右侧',
    closeAll: '关闭所有',
    pin: '固定标签',
    unpin: '取消固定'
  },
  icon: {
    themeConfig: '主题配置',
    themeSchema: '主题模式',
    lang: '切换语言',
    fullscreen: '全屏',
    fullscreenExit: '退出全屏',
    reload: '刷新页面',
    collapse: '折叠菜单',
    expand: '展开菜单',
    pin: '固定',
    unpin: '取消固定'
  },
  datatable: {
    itemCount: '共 {total} 条'
  }
};

export default local;
