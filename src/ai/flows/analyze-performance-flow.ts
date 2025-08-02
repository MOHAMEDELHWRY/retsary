'use server';
/**
 * @fileOverview An AI agent for analyzing financial performance from transaction data.
 *
 * - analyzePerformance - A function that takes transaction data and returns a summary.
 * - PerformanceAnalysisInput - The input type for the analyzePerformance function.
 * - PerformanceAnalysisOutput - The return type for the analyzePerformance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const TransactionSchemaForAI = z.object({
  date: z.string().describe('The date of the transaction in ISO format.'),
  supplierName: z.string(),
  governorate: z.string(),
  city: z.string(),
  totalSellingPrice: z.number(),
  profit: z.number(),
});

const PerformanceAnalysisInputSchema = z.object({
  transactions: z.array(TransactionSchemaForAI).describe('A list of all financial transactions to be analyzed.'),
  totalProfit: z.number().describe('The total net profit after all expenses.'),
  totalExpenses: z.number().describe('The total amount of all expenses.'),
});
export type PerformanceAnalysisInput = z.infer<typeof PerformanceAnalysisInputSchema>;

const PerformanceAnalysisOutputSchema = z.object({
  analysis: z.string().describe('A detailed financial analysis summary in Arabic markdown format.'),
});
export type PerformanceAnalysisOutput = z.infer<typeof PerformanceAnalysisOutputSchema>;

export async function analyzePerformance(input: PerformanceAnalysisInput): Promise<PerformanceAnalysisOutput> {
  try {
    // Call the actual AI flow instead of returning mock data
    const result = await analyzePerformanceFlow(input);
    return result;
  } catch (error) {
    console.error("AI analyzePerformance error:", error);
    
    // Provide specific error messages based on error type
    let errorMessage = "حدث خطأ أثناء تحليل البيانات بواسطة الذكاء الاصطناعي.";
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = "خطأ في مفتاح API للذكاء الاصطناعي. يرجى التحقق من إعدادات المفتاح.";
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        errorMessage = "تم تجاوز حد الاستخدام لخدمة الذكاء الاصطناعي. يرجى المحاولة لاحقًا.";
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = "خطأ في الاتصال بخدمة الذكاء الاصطناعي. يرجى التحقق من الاتصال بالإنترنت.";
      }
    }
    
    return { 
      analysis: `${errorMessage} يرجى المحاولة مرة أخرى لاحقًا.` 
    };
  }
}

const prompt = ai.definePrompt({
  name: 'analyzePerformancePrompt',
  input: {schema: PerformanceAnalysisInputSchema},
  output: {schema: PerformanceAnalysisOutputSchema},
  prompt: `أنت محلل مالي خبير. مهمتك هي تحليل بيانات المعاملات المالية التالية وتقديم تقرير موجز وذكي باللغة العربية.

يجب أن يكون تحليلك على شكل نقاط واضحة باستخدام Markdown، وأن يغطي الجوانب التالية:

1.  **نظرة عامة على الأداء**: ابدأ بملخص عام للأداء المالي، مع الإشارة إلى إجمالي الأرباح والمصروفات.
2.  **الموردون الأعلى أداءً**: حدد الموردين الذين حققوا أعلى أرباح. اذكر أفضل 3 موردين مع أرباح كل منهم.
3.  **المناطق الجغرافية الأكثر مبيعًا**: حدد المحافظات أو المدن التي تحقق أعلى مبيعات. اذكر أفضل 3 مناطق مع إجمالي مبيعاتها.
4.  **رؤى واقتراحات**: بناءً على تحليلك، قدم رؤى قابلة للتنفيذ. على سبيل المثال، هل هناك موردون أداؤهم ضعيف؟ هل هناك فرص للنمو في مناطق معينة؟ قدم توصيتين على الأقل لتحسين الأداء.

إجمالي صافي الربح (بعد خصم المصروفات): {{{totalProfit}}}
إجمالي المصروفات: {{{totalExpenses}}}

بيانات المعاملات للتحليل:
\`\`\`json
{{{json transactions}}}
\`\`\`

اكتب التقرير بالكامل باللغة العربية.`,
});


export const analyzePerformanceFlow = ai.defineFlow(
  {
    name: 'analyzePerformanceFlow',
    inputSchema: PerformanceAnalysisInputSchema,
    outputSchema: PerformanceAnalysisOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      if (!output) {
        return { analysis: "لم يتمكن الذكاء الاصطناعي من إنشاء تحليل. قد تكون هناك مشكلة مؤقتة. يرجى المحاولة مرة أخرى لاحقًا." };
      }
      return output;
    } catch (error) {
      console.error("AI analyzePerformanceFlow error:", error);
      return { analysis: "حدث خطأ أثناء تحليل البيانات بواسطة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى لاحقًا." };
    }
  }
);
