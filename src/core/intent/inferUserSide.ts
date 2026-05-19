/**
 * 从自然语言推断 B/C 端（R-01 / R-03），与模板 category 取并集：文本强信号优先。
 */

/** 强 B 端信号：组织向活动、会务、采购等 */
export function inferUserSideFromDescription(raw: string): 'B端' | 'C端' | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();

  // 显式个人声明（优先）：用于处理“包含组织词但明确声明不涉及组织”的冲突口径
  if (/(不涉及|不包含|无需)\s*(公司|企业|单位|组织)|仅\s*个人|纯\s*个人/.test(t)) {
    return 'C端';
  }

  // 强 B：会务 / 学术 / 组织活动
  if (/学术\s*会议|学术\s*论坛|技术\s*论坛|技术\s*峰会|行业\s*峰会|企业\s*年会|公司\s*年会/.test(t)) {
    return 'B端';
  }
  // 论坛/峰会类：若包含明确组织信号，则视为 B（即使出现“个人”）
  if (/(论坛|峰会)/.test(t) && /(公司|企业|单位|组织|园区|社区|我们公司)/.test(t)) {
    return 'B端';
  }
  if (/(论坛|峰会)/.test(t) && !/个人/.test(t)) {
    return 'B端';
  }
  if (/年会/.test(t) && /(公司|企业|单位|组织|行业|客户)/.test(t)) {
    return 'B端';
  }
  if (t.includes('团建') || t.includes('客户答谢') || t.includes('答谢会')) {
    return 'B端';
  }
  if (/(企业|公司|单位)\s*(策划|活动|主办)/.test(t)) {
    return 'B端';
  }
  if (t.includes('采购') || t.includes('报销') || t.includes('办公')) {
    return 'B端';
  }
  if (/(市集|展会|博览会)/.test(t) && /(公司|企业|单位|组织|园区|社区|商户|招商|摊位)/.test(t)) {
    return 'B端';
  }

  // 强 C：个人 / 家庭向（在未命中 B 时）
  if (/个人|家庭|亲子|孩子|儿子|女儿|我家/.test(t) && !/(公司|企业|单位|组织)/.test(t)) {
    return 'C端';
  }

  if (lower.includes('outing') && t.includes('公司')) {
    return 'B端';
  }

  return null;
}
