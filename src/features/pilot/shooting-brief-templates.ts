import type { IdeaRecord } from '../research/research-api'

export interface ShootingBriefTemplate {
  whyNow: string
  interviewQuestions: string[]
  keyTalkingPoints: string[]
  keyTakeaway: string
  suggestedCta: string
  targetDuration: string
  bRollVisualSuggestions: string[]
  riskFactCheckNotes: string[]
}

const templates: Record<string, ShootingBriefTemplate> = {
  '最近很多商家开始倒闭了，你怎样看？': {
    whyNow: '经营压力是 SME 老板持续关心的话题。可以借这个问题讨论企业出现问题前，老板可从日常经营记录观察哪些早期信号；不要把个别观察包装成整体市场结论。',
    interviewQuestions: [
      '你最近为什么会特别注意到商家经营困难这个现象？',
      '企业真正出问题以前，老板通常会先看到哪些早期信号？',
      '销售额、现金流、毛利、应收账款和库存，老板应该怎样一起看？',
      '老板发现信号后，第一步最实际可以做什么？',
      '什么时候应该尽快找会计、顾问或系统伙伴协助？',
    ],
    keyTalkingPoints: ['区分个人观察、客户经验与有数据支持的市场趋势', '早期信号可从现金流、回款、毛利、库存和重复客户变化讨论', '记录完整，老板才有机会及早判断与调整', '案例只谈共通模式，不透露可识别客户资料'],
    keyTakeaway: '市场环境未必能控制，但老板可以更早看见自己企业的经营信号并采取行动。',
    suggestedCta: '先检查最近三个月的现金流、应收账款与库存变化，看看有没有需要马上处理的信号。',
    targetDuration: '60–90 秒',
    bRollVisualSuggestions: ['Steven 对镜回答', '现金流／应收／库存关键词字幕', '匿名化经营报表或系统 dashboard close-up', '店面或 SME 日常营运通用画面'],
    riskFactCheckNotes: ['Fact Check Required：如要声称“很多商家倒闭”或引用倒闭趋势，拍摄前必须补可靠来源与时间范围', '不得把个别客户经验描述为整体市场统计', '客户案例必须匿名化并确认不会泄露商业资料'],
  },
  '做过这么多家企业的系统，最喜欢怎样的顾客？什么样的顾客最难合作？': {
    whyNow: '用轻松问答分享企业与系统供应商怎样合作得更顺利，也能让潜在客户理解成功实施系统需要双方怎样配合。',
    interviewQuestions: ['什么特质会让你一开始就觉得这位顾客很好合作？', '需求清楚、愿意沟通和愿意改变，哪一个最重要？为什么？', '哪些合作习惯最容易让系统项目卡住？', '遇到意见不同的客户，你通常怎样把合作拉回正轨？', '如果老板准备导入系统，你最希望他先做好什么？'],
    keyTalkingPoints: ['聚焦合作行为，不标签化某类客户', '好的实施需要目标、负责人、资料与反馈机制', '供应商也有责任解释边界、风险与执行步骤', '真实例子只保留不可识别的共通经验'],
    keyTakeaway: '好合作不是客户凡事答应，而是双方愿意说清目标、及时反馈并共同承担执行。',
    suggestedCta: '准备导入系统前，先确认内部负责人、目标与决策方式，会让合作顺很多。',
    targetDuration: '60–90 秒',
    bRollVisualSuggestions: ['轻松侧拍式 Q&A', '会议讨论或需求确认通用画面', '白板流程／project checklist close-up', '“目标、负责人、反馈”关键词字幕'],
    riskFactCheckNotes: ['不得点名或暗示可识别客户', '避免把个人偏好说成 LKSoft 的正式客户筛选政策', '如提到项目结果或年资数字，拍摄前确认内部记录'],
  },
  '不是已经有 SST 了吗？为什么安华又提 GST？': {
    whyNow: '税制讨论会影响 SME 对系统、账务和营运准备的判断。内容应在拍摄当天以最新官方资料为准，用老板容易理解的语言解释“目前制度”和“讨论中的机制”有什么不同。',
    interviewQuestions: ['以目前官方资料来看，马来西亚现行的是哪一种税制，最近讨论的重点是什么？', 'SST 和 GST 在征收方式与企业记录要求上，最基本的差别是什么？', '为什么政策讨论会再次提到 GST 的某些机制？', '企业老板现在需要马上做什么，哪些事情暂时不应该过度反应？', '无论未来政策怎样调整，企业系统与账务资料应该先准备好什么？'],
    keyTalkingPoints: ['明确区分现行政策、公开讨论和个人观点', '用流程解释采购、销售、税务、e-Invoice 与会计记录之间的关系', '不要把政策研究或讨论表述成已确定实施', '涉及税务判断时提醒观众参考最新官方说明及专业顾问'],
    keyTakeaway: '税务政策可能调整，但企业把交易与账务记录做完整，是现在就能掌握的准备。',
    suggestedCta: '先检查采购、销售、税务、e-Invoice 与会计记录是否完整；具体税务判断请参考最新官方资料和专业意见。',
    targetDuration: '60–90 秒',
    bRollVisualSuggestions: ['Steven 镜外问答', 'SST／GST 对比关键词卡', 'Purchase → Sales → Tax → e-Invoice → Accounting 流程图', '官方资料页面只在核实日期与来源后入镜'],
    riskFactCheckNotes: ['Fact Check Required：拍摄当天核对 MOF、LHDN、RMCD 或首相办公室的最新官方声明', 'Fact Check Required：确认现行 SST 范围、税率及任何 GST 讨论的原文与日期', '不得声称 GST 已确定回归，除非拍摄当天已有正式官方决定', '内容为一般商业教育，不构成税务建议'],
  },
  '你觉得一个企业里面，什么部门最重要？': {
    whyNow: '老板常把资源集中在单一部门，这个问题适合带出不同阶段的企业需要不同优先级，以及部门之间必须形成完整经营循环。',
    interviewQuestions: ['如果一家公司只能先把一个部门做好，你会怎样回答？', '初创期、成长期和稳定期，最需要优先补强的部门会不会不同？', '销售、财务、运营和人事之间最常见的断点是什么？', '老板怎样判断瓶颈是在某个部门，还是部门之间没有协作？', '你会建议老板每周一起看哪些跨部门信息？'],
    keyTalkingPoints: ['避免给所有企业一个固定答案', '部门重要性应结合企业阶段与当前瓶颈', '销售带来需求，运营兑现，财务提供反馈，人事支撑能力', '系统与共同指标可帮助部门协作，但不能代替管理责任'],
    keyTakeaway: '企业不是靠一个“最重要部门”运作，而是靠关键部门围绕同一个目标形成闭环。',
    suggestedCta: '回去看看公司最常卡在哪一个交接点，而不只是问哪一个部门最忙。',
    targetDuration: '60–90 秒',
    bRollVisualSuggestions: ['部门名称卡片依次出现', '销售→运营→财务→人事闭环图', '跨部门会议或白板通用画面', 'Steven 对镜总结'],
    riskFactCheckNotes: ['如使用真实公司案例，必须匿名化', '不要把个人管理偏好描述为适用于所有行业的标准答案'],
  },
  '为什么公司名字叫 LKSOFT？': {
    whyNow: '品牌名字背后的真实由来适合建立记忆点与个人连接，但故事必须由 Steven 亲自确认，不能由模板补写。',
    interviewQuestions: ['LKSoft 这个名字最初是谁提出的？', '“LK”与“Soft”分别有什么真实含义？', '当时为什么决定用这个名字，而不是其他选择？', '公司刚开始时做的事情，与今天的 LKSoft 有什么延续或变化？', '现在回头看，这个名字对你代表什么？'],
    keyTalkingPoints: ['由 Steven 说明真实命名过程与当时背景', '可分享曾考虑过的名字或选择过程，但只使用本人确认的记忆', '连接品牌名称、创业初衷与今天服务客户的方向', '保留自然回忆，不需要包装成完美创业神话'],
    keyTakeaway: '品牌名称背后的真实意义必须由 Steven 确认后再形成最终 takeaway。',
    suggestedCta: '如果你也好奇 LKSoft 的创业故事，可以继续关注接下来的老板 IP 内容。',
    targetDuration: '60–90 秒',
    bRollVisualSuggestions: ['旧 Logo／名片／办公室照片（确认年份后使用）', '现有 LKSoft Logo detail shot', 'Steven 翻看真实旧资料', '品牌名称字样作为开场视觉'],
    riskFactCheckNotes: ['Fact Check Required：确认 LKSoft 名字的真实由来及每个字母含义', 'Fact Check Required：确认创立年份、创办人与早期业务叙述', '任何旧照片、Logo 或文件需确认日期与使用权限', '不得由制作团队替 Steven 补写个人故事'],
  },
  '你觉得怎样的企业或老板，会有很好的发展？': {
    whyNow: '从长期接触企业经营者的观察，整理有成长潜力的共同习惯，能提供反思方向；内容应强调这是经验观察，不是成功保证。',
    interviewQuestions: ['你接触过不同老板后，最常看到哪些长期成长特质？', '愿意学习、敢做决定和会看数据，哪一种更关键？', '发展好的老板通常怎样面对错误或坏消息？', '他们怎样建立团队，而不是所有事情都自己做？', '老板今天可以开始培养哪一个习惯？'],
    keyTalkingPoints: ['谈可观察的行为与习惯，不给人格贴标签', '成长潜力不等于短期业绩保证', '可从学习速度、数据意识、执行复盘、授权与客户价值讨论', '外部环境、行业与资源差异也会影响结果'],
    keyTakeaway: '长期发展通常来自持续学习、看清现实并带团队执行，而不是某一种老板性格。',
    suggestedCta: '选一个最需要改善的经营习惯，未来四周用可观察的行动去练习。',
    targetDuration: '60–90 秒',
    bRollVisualSuggestions: ['Steven 观点式正面镜头', '学习／数据／执行／团队关键词字幕', '团队讨论与复盘通用画面', 'notebook 或 dashboard close-up'],
    riskFactCheckNotes: ['不得把观察表述成成功因果或保证', '真实企业例子需匿名化并避免泄露经营资料', '如引用成功率、增长或年资数字，必须先核对来源'],
  },
  '很多人讲00后很难融入企业文化，你怎样看？': {
    whyNow: '世代与职场文化是团队经常讨论的话题。用双向视角探讨年轻员工和管理方式，可以避免把问题简单归咎于某一代人。',
    interviewQuestions: ['你认同“00后难融入企业文化”这个说法吗？为什么？', '你看到的差异更像年龄、沟通方式，还是公司制度问题？', '年轻员工最希望公司说清楚什么？', '管理者有哪些旧习惯可能让新一代更难投入？', '双方可以怎样建立更实际的工作共识？'],
    keyTalkingPoints: ['不要把出生年份当成人格或工作能力结论', '区分个别经验、管理问题与世代趋势', '讨论目标、反馈、成长、边界与沟通方式', '企业文化也需要随着团队与工作环境调整'],
    keyTakeaway: '融入不是单方面服从；公司与员工都需要把期待、反馈和合作方式说清楚。',
    suggestedCta: '下一次觉得“这一代很难沟通”时，先把目标、标准和反馈方式讲具体。',
    targetDuration: '60–90 秒',
    bRollVisualSuggestions: ['不同年龄员工协作的通用画面', '目标／反馈／成长／边界关键词字幕', 'Steven 与镜外年轻同事问答', '会议或一对一沟通场景'],
    riskFactCheckNotes: ['避免以“00后”概括所有年轻员工', '如引用职场调查或离职率，必须核对样本、地区和年份', '真实员工故事需取得同意并移除可识别资料'],
  },
}

export function createShootingBriefTemplate(idea: IdeaRecord): ShootingBriefTemplate {
  return templates[idea.title] ?? {
    whyNow: idea.why_it_works ?? idea.our_angle ?? '',
    interviewQuestions: [
      `你为什么觉得“${idea.title}”值得现在讨论？`,
      '从你的实际经验来看，最容易被忽略的重点是什么？',
      '老板或团队可以先采取什么实际行动？',
    ],
    keyTalkingPoints: [idea.our_angle ?? '由出镜者确认核心表达方向', '区分实际经验、个人观点与需要外部来源支持的事实'],
    keyTakeaway: '由出镜者审核后确认最终 takeaway。',
    suggestedCta: '请观众结合自己的实际情况检查下一步行动。',
    targetDuration: '60–90 秒',
    bRollVisualSuggestions: ['出镜者对镜回答', '核心关键词字幕', '与主题相关且来源清楚的通用工作画面'],
    riskFactCheckNotes: ['Fact Check Required：拍摄前核对所有政策、数字、日期与可识别案例', '模板只提供提问与表达方向，不替出镜者决定立场'],
  }
}

export function toShootingBriefGenerationInput(idea: IdeaRecord) {
  const template = createShootingBriefTemplate(idea)
  return {
    ideaId: idea.id,
    whyNow: template.whyNow,
    interviewQuestions: template.interviewQuestions,
    keyTalkingPoints: template.keyTalkingPoints,
    keyTakeaway: template.keyTakeaway,
    suggestedCta: template.suggestedCta,
    targetDuration: template.targetDuration,
    bRollVisualSuggestions: template.bRollVisualSuggestions,
    riskFactCheckNotes: template.riskFactCheckNotes,
  }
}