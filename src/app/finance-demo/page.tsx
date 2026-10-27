import {notFound} from "next/navigation";
import FinanceDemoClient from "@/components/finance-demo";
export default function FinanceDemoPage(){
  if(process.env.VERCEL_ENV==="production") notFound();
  return <FinanceDemoClient/>;
}
