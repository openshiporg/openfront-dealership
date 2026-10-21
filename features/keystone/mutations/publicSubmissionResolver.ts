import { SubmissionError } from './submissionErrors'

type SubmissionService = (root: unknown, args: any, context: any) => Promise<Record<string, unknown>>

export function publicSubmissionResolver(service: SubmissionService) {
  return async (root: unknown, args: any, context: any) => {
    try {
      return {
        ok: true,
        errorCode: null,
        errorMessage: null,
        ...(await service(root, args, context)),
      }
    } catch (error) {
      if (error instanceof SubmissionError) {
        return {
          ok: false,
          errorCode: error.submissionCode,
          errorMessage: error.message,
        }
      }
      console.error('Unexpected public submission error:', error)
      return {
        ok: false,
        errorCode: 'SUBMISSION_FAILED',
        errorMessage: 'Unable to process this request. Please try again or contact the dealership.',
      }
    }
  }
}
