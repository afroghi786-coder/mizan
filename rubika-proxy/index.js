export default {
  async fetch(request, env, ctx) {
    // پاسخ به درخواست‌های پیش‌پرواز مرورگر (CORS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      const url = new URL(request.url);
      // ساخت آدرس مقصد در روبیکا
      const targetUrl = 'https://botapi.rubika.ir/v3' + url.pathname;
      
      // کپی کردن درخواست اصلی برای ارسال به روبیکا
      const proxyReq = new Request(targetUrl, request);
      
      // حذف هدرهایی که ممکن است روبیکا را حساس کند
      proxyReq.headers.delete('Origin');
      proxyReq.headers.delete('Referer');
      proxyReq.headers.delete('Host');

      // ارسال درخواست به روبیکا (بدون دست زدن به بدنه، عکس‌ها سالم می‌مانند)
      const response = await fetch(proxyReq);

      // ساخت پاسخ جدید با هدرهای CORS
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      
      return newResponse;
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};