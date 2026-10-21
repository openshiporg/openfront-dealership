import { GraphQLError } from 'graphql'

export class SubmissionError extends GraphQLError {
  readonly status: number
  readonly submissionCode: string

  constructor(
    message: string,
    status = 400,
    code = 'INVALID_SUBMISSION'
  ) {
    super(message, {
      extensions: {
        code,
        http: { status },
      },
    })
    this.name = 'SubmissionError'
    this.status = status
    this.submissionCode = code
  }
}

export function submissionErrorResponse(error: unknown) {
  if (error instanceof SubmissionError) {
    return {
      status: error.status,
      body: { error: error.message, code: error.submissionCode },
    }
  }
  return {
    status: 500,
    body: { error: 'Unable to process this request. Please try again or contact the dealership.' },
  }
}
