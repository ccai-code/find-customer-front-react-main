// 防抖函数实现
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 数据映射函数，确保数据格式一致性
export const mapCommentData = (rawComment: any) => {
  return {
    comment_id: rawComment.comment_id || rawComment.id || '',
    '评论时间': rawComment['评论时间'] || rawComment.time || rawComment.comment_time || '',
    '用户昵称': rawComment['用户昵称'] || rawComment.nickname || rawComment.user_nickname || '',
    'IP地址': rawComment['IP地址'] || rawComment.province || rawComment.ip_address || '',
    '评论内容': rawComment['评论内容'] || rawComment.content || rawComment.comment_content || '',
    intent_customer: rawComment.intent_customer || rawComment.intent || rawComment['意向客户'] || '',
    '分析理由': rawComment['分析理由'] || rawComment.reason || rawComment.analysis_reason || '',
    // 链接字段
    '用户链接': rawComment['用户链接'] || rawComment.user_link || rawComment.userLink || '',
    '内容链接': rawComment['内容链接'] || rawComment.content_link || rawComment.contentLink || '',
    // 保留其他字段
    id: rawComment.id,
    '意向客户': rawComment['意向客户'],
    '用户签名': rawComment['用户签名']
  };
};
