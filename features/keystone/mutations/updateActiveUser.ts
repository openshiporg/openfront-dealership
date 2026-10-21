const ALLOWED_ONBOARDING_STATUSES = new Set(['not_started', 'in_progress', 'completed', 'dismissed']);

type UpdateActiveUserArgs = {
  data: {
    onboardingStatus?: string | null;
  };
};

type KeystoneContext = {
  session?: {
    itemId?: string;
  };
  query: {
    User: {
      updateOne(args: {
        where: { id: string };
        data: Record<string, unknown>;
        query: string;
      }): Promise<unknown>;
    };
  };
};

export default async function updateActiveUser(
  _root: unknown,
  { data }: UpdateActiveUserArgs,
  context: KeystoneContext
) {
  const userId = context.session?.itemId;

  if (!userId) {
    throw new Error('You must be signed in to update onboarding status.');
  }

  const updateData: Record<string, unknown> = {};

  if (data.onboardingStatus !== undefined && data.onboardingStatus !== null) {
    if (!ALLOWED_ONBOARDING_STATUSES.has(data.onboardingStatus)) {
      throw new Error('Invalid onboarding status.');
    }

    updateData.onboardingStatus = data.onboardingStatus;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No supported active user fields were provided.');
  }

  return context.query.User.updateOne({
    where: { id: userId },
    data: updateData,
    query: 'id onboardingStatus',
  });
}
