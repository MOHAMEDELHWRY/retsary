// src/app/api/analyze-performance/route.ts
import {NextRequest, NextResponse} from 'next/server';
import {
  analyzePerformance,
  type PerformanceAnalysisInput,
} from '@/ai/flows/analyze-performance-flow';

export async function POST(req: NextRequest) {
  try {
    const body: PerformanceAnalysisInput = await req.json();

    if (!body.transactions) {
      return NextResponse.json(
        {error: 'Missing transactions data'},
        {status: 400}
      );
    }

    const analysisResult = await analyzePerformance(body);

    if (analysisResult.analysis.includes('خطأ')) {
      return NextResponse.json(analysisResult, {status: 500});
    }

    return NextResponse.json(analysisResult);
  } catch (error: any) {
    console.error('API Error in /api/analyze-performance:', error);
    return NextResponse.json(
      {error: error.message || 'An unexpected error occurred'},
      {status: 500}
    );
  }
}
