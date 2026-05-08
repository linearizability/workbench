/**
 * 时间戳工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_TIMESTAMP_CORE = {
    /**
     * 时间戳与日期互转
     * @param {Object} options — { input: { value }, params: { mode, unit } }
     * @returns {Promise<{ output: { text, iso, utc, seconds, millis }, error }>}
     */
    async run({ input, params }) {
      const mode = params.mode || 'tsToDate';
      const unit = params.unit || 'auto';

      if (mode === 'tsToDate') {
        const raw = String(input.value ?? '').trim();
        if (!raw) {
          return { output: null, error: '请输入时间戳' };
        }
        const num = Number(raw);
        if (isNaN(num) || num < 0) {
          return { output: null, error: '请输入有效的时间戳' };
        }

        let millis;
        if (unit === 'seconds') millis = num * 1000;
        else if (unit === 'millis') millis = num;
        else millis = raw.length <= 10 ? num * 1000 : num;

        const date = new Date(millis);
        if (isNaN(date.getTime())) {
          return { output: null, error: '无法解析该时间戳' };
        }

        return {
          output: {
            text: formatDate(date, 'YYYY-MM-DD HH:mm:ss'),
            iso: date.toISOString(),
            utc: date.toUTCString(),
            seconds: Math.floor(millis / 1000),
            millis
          },
          error: null
        };
      } else {
        // dateToTs
        const val = input.value ?? '';
        if (!val) {
          return { output: null, error: '请输入日期' };
        }
        const date = new Date(val);
        if (isNaN(date.getTime())) {
          return { output: null, error: '无效的日期' };
        }

        const millis = date.getTime();
        return {
          output: {
            text: String(Math.floor(millis / 1000)),
            seconds: Math.floor(millis / 1000),
            millis
          },
          error: null
        };
      }
    }
  };

})();
