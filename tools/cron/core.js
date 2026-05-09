/**
 * Cron 工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_CRON_CORE = {
    /**
     * 解析或生成 Cron 表达式
     * @param {Object} options — { input: { expression }, params: { mode } }
     * @returns {Promise<{ output: { description, nextRuns, fields, expression }, error }>}
     */
    async run({ input, params }) {
      const mode = params.mode || 'parse';

      if (mode === 'parse') {
        const expression = (input.expression ?? '').trim();
        if (!expression) {
          return { output: null, error: '请输入 Cron 表达式' };
        }

        // 字段分解（支持 5 字段和 6 字段格式）
        const parts = expression.split(/\s+/);
        const hasSeconds = parts.length >= 6;
        const fields = {
          second: hasSeconds ? (parts[0] || '*') : '0',
          minute: hasSeconds ? (parts[1] || '*') : (parts[0] || '*'),
          hour: hasSeconds ? (parts[2] || '*') : (parts[1] || '*'),
          dayOfMonth: hasSeconds ? (parts[3] || '*') : (parts[2] || '*'),
          month: hasSeconds ? (parts[4] || '*') : (parts[3] || '*'),
          dayOfWeek: hasSeconds ? (parts[5] || '*') : (parts[4] || '*')
        };

        // 自然语言描述
        let description = '';
        try {
          if (typeof cronstrue !== 'undefined' && cronstrue.toString) {
            description = cronstrue.toString(expression, { locale: 'zh_CN', use24HourTimeFormat: true, useSeconds: hasSeconds });
          } else {
            return { output: null, error: 'cronstrue 库未加载' };
          }
        } catch (err) {
          return { output: null, error: '无效的 Cron 表达式' };
        }

        // 未来执行时间
        let nextRuns = [];
        try {
          if (typeof Cron !== 'undefined') {
            const job = new Cron(expression);
            const runs = job.nextRuns(10);
            if (runs && runs.length > 0) {
              nextRuns = runs.map(dt => ({
                iso: dt.toISOString(),
                local: formatDate(dt, 'YYYY-MM-DD HH:mm:ss'),
                relative: relativeTime(dt)
              }));
            }
          }
        } catch (err) {
          // 忽略计算错误，只返回描述
        }

        return {
          output: {
            description,
            nextRuns,
            fields,
            expression,
            text: description
          },
          error: null
        };
      } else {
        // generate 模式：从字段构建表达式（6 字段含秒）
        const second = input.second ?? '0';
        const minute = input.minute ?? '*';
        const hour = input.hour ?? '*';
        const dayOfMonth = input.dayOfMonth ?? '*';
        const month = input.month ?? '*';
        const dayOfWeek = input.dayOfWeek ?? '*';
        const expression = `${second} ${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;

        let description = '';
        try {
          if (typeof cronstrue !== 'undefined' && cronstrue.toString) {
            description = cronstrue.toString(expression, { locale: 'zh_CN', use24HourTimeFormat: true, useSeconds: true });
          }
        } catch {
          description = '无效的表达式';
        }

        return {
          output: {
            description,
            expression,
            text: expression
          },
          error: null
        };
      }
    }
  };

  // ── 内部函数 ──

  function relativeTime(date) {
    const diff = date.getTime() - Date.now();
    const abs = Math.abs(diff);
    if (diff < 0) return '已过期';
    if (abs < 60 * 1000) return '即将执行';
    if (abs < 60 * 60 * 1000) return Math.floor(abs / 60000) + ' 分钟后';
    if (abs < 24 * 60 * 60 * 1000) return Math.floor(abs / 3600000) + ' 小时后';
    if (abs < 30 * 24 * 60 * 60 * 1000) return Math.floor(abs / 86400000) + ' 天后';
    return Math.floor(abs / (30 * 86400000)) + ' 个月后';
  }

})();
