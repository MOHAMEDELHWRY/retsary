import { redirect } from "next/navigation";

export default function Page() {
  // تم إلغاء صفحة أرصدة/مبيعات العملاء القديمة — إعادة التوجيه إلى سجل العملاء
  redirect("/customers-log");
}
