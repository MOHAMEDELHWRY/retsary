import { redirect } from "next/navigation";

export default function Page() {
  // تم إلغاء تقرير مبيعات العملاء — إعادة التوجيه إلى سجل العملاء
  redirect("/customers-log");
}
