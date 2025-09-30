export interface Comment {
  // 使用API实际返回的字段名
  comment_id: string;
  '评论时间': string;
  '用户昵称': string;
  'IP地址': string;
  '评论内容': string;
  intent_customer: string;
  '分析理由': string;
  // 链接相关字段
  '用户链接'?: string;
  '内容链接'?: string;
  // 保留一些可能存在的字段
  id?: number;
  '意向客户'?: string;
  '用户签名'?: string;
}

export interface Filters {
  nickname: string;  // 对应 '用户昵称'
  province: string;  // 对应 'IP地址'
  content: string;   // 对应 '评论内容'
  intent: string;    // 对应 intent_customer
}

export interface Task {
  platform: string;
  keyword: string;
  progress?: number;
}
