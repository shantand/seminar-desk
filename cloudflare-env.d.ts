declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_PASSWORD?: string;
    SESSION_SECRET?: string;
    WHATSAPP_ACCESS_TOKEN?: string;
    WHATSAPP_PHONE_NUMBER_ID?: string;
    WHATSAPP_APP_SECRET?: string;
    WHATSAPP_VERIFY_TOKEN?: string;
    WHATSAPP_TEMPLATE_NAME?: string;
    WHATSAPP_TEMPLATE_LANG?: string;
  }
}
