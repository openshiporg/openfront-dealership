import { GraphQLClient, gql } from 'graphql-request';
import { startOnboarding, completeOnboarding } from '../actions/onboarding';
import { SECTION_DEFINITIONS } from '../config/templates';
import { TemplateType, OnboardingStep } from './useOnboardingState';

const GRAPHQL_ENDPOINT = '/api/graphql';

interface OnboardingApiProps {
  selectedTemplate: TemplateType;
  currentJsonData: any;
  completedItems: Record<string, string[]>;
  setProgress: (message: string) => void;
  setItemLoading: (type: string, item: string) => void;
  setItemCompleted: (type: string, item: string) => void;
  setItemError: (type: string, item: string, errorMessage: string) => void;
  setStep: (step: OnboardingStep) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  resetOnboardingState: () => void;
}

export function useOnboardingApi({
  selectedTemplate,
  currentJsonData,
  completedItems,
  setProgress,
  setItemLoading,
  setItemCompleted,
  setItemError,
  setStep,
  setError,
  setIsLoading,
  resetOnboardingState,
}: OnboardingApiProps) {

  const runOnboarding = async () => {
    setIsLoading(true);
    setError(null);
    resetOnboardingState();
    setStep('progress');
    setProgress('Starting dealership onboarding...');

    // Mark onboarding as started
    try {
      await startOnboarding();
    } catch (error) {
      console.error('Error marking onboarding as started:', error);
    }

    try {
      const client = new GraphQLClient(GRAPHQL_ENDPOINT, {
        headers: { 'Content-Type': 'application/json' },
      });

      await createDealership(client, currentJsonData);
      const createdCurrencies = await createCurrencies(client, currentJsonData);
      const createdCountries = await createCountries(client, currentJsonData);
      const createdPaymentProviders = await createPaymentProviders(client, currentJsonData);
      const createdFulfillmentProviders = await createFulfillmentProvider(client);
      const createdRegions = await createRegions(client, currentJsonData, createdCurrencies, createdPaymentProviders, createdFulfillmentProviders, createdCountries);
      await createShippingOptions(client, currentJsonData, createdFulfillmentProviders, createdRegions);
      await createVehicleMakes(client, currentJsonData);
      await createVehicleTypes(client, currentJsonData);
      await createServices(client, currentJsonData);
      await createStaff(client, currentJsonData);

      setProgress('Onboarding complete!');

      // Mark onboarding as completed
      try {
        await completeOnboarding();
      } catch (error) {
        console.error('Error marking onboarding as completed:', error);
      }

      setStep('done');
    } catch (e: any) {
      handleOnboardingError(e);
    } finally {
      setIsLoading(false);
    }
  };

  const createDealership = async (client: GraphQLClient, data: any) => {
    setProgress('Creating dealership...');

    const dealershipData = data.dealership || {
      name: 'Elite Auto Dealership',
      defaultCurrencyCode: 'usd',
      homepageTitle: 'Premium Vehicle Sales & Service',
      homepageDescription: 'Your trusted partner for quality vehicles and automotive services.',
      logoIcon: '<svg fill="none" height="100%" viewBox="0 0 44 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="m17.6264 6.5h14.8017l11.4661 18.6661-15.7786 15.9489-22.68835-4.0459-5.157719-19.2098zm.5273 4.9692-6.816 15.105 6.4504 5.3411 8.8246-3.7975zm12.3276 15.3 9.2139-2.7073-7.1983-11.7184zm-.6163-17.2692h-9.3468l7.3309 14.4284zm6.9795 18.5263-6.779 1.9919-.5448 5.4109zm-10.5005 9.008.5824-5.7856-6.0573 2.6067zm-6.8394-.5022-10.91261-1.9459 1.64741-5.0264 6.438 5.3308zm-11.69782-9.1824-2.7037-3.0571 1.66868 6.215zm-3.53432-8.5248 4.81433 5.4437 5.50351-12.1963z" fill="#155eef" fill-rule="evenodd"/></svg>',
      logoColor: '0',
    };

    setItemLoading('dealership', dealershipData.name);

    try {
      // Placeholder - implement actual dealership creation mutation
      setItemCompleted('dealership', dealershipData.name);
      return 'dealership-id';
    } catch (error: any) {
      console.error('Error creating dealership:', error);
      return '';
    }
  };

  const createCurrencies = async (client: GraphQLClient, data: any) => {
    setProgress('Creating currencies...');
    const createdCurrencies: Record<string, string> = {};

    for (const region of data.regions) {
      const regionName = `${region.name || 'Unknown'} (${(region.currencyCode || 'USD').toUpperCase()})`;
      setItemLoading('regions', regionName);

      try {
        const mutation = gql`
          mutation CreateCurrency($data: CurrencyCreateInput!) {
            createCurrency(data: $data) {
              id
              code
            }
          }
        `;
        const result = (await client.request(mutation, {
          data: {
            code: region.currencyCode,
            symbol: region.currencySymbol,
            symbolNative: region.currencySymbol,
            name: region.currencyName,
          },
        })) as { createCurrency: { id: string } };
        createdCurrencies[region.currencyCode] = result.createCurrency.id;

        setItemCompleted('regions', regionName);
      } catch (itemError: any) {
        let itemErrorMessage = itemError.message || 'Unknown error';
        if (itemError.response?.errors) {
          itemErrorMessage = itemError.response.errors
            .map((err: any) => err.message || JSON.stringify(err))
            .join('\n');
        }
        setItemError('regions', regionName, itemErrorMessage);
        console.error(`Error creating currency for ${region.name}:`, itemError);
      }
    }

    return createdCurrencies;
  };

  const createCountries = async (client: GraphQLClient, data: any) => {
    setProgress('Creating countries...');
    const createdCountries: Record<string, string> = {};

    for (const region of data.regions) {
      for (const country of region.countries) {
        const mutation = gql`
          mutation CreateCountry($data: CountryCreateInput!) {
            createCountry(data: $data) {
              id
              iso2
            }
          }
        `;
        const result = (await client.request(mutation, {
          data: country,
        })) as { createCountry: { id: string } };
        createdCountries[country.iso2] = result.createCountry.id;
      }
    }

    return createdCountries;
  };

  const createPaymentProviders = async (client: GraphQLClient, data: any) => {
    setProgress('Creating payment providers...');
    const createdPaymentProviders: Record<string, string> = {};

    for (const provider of data.paymentProviders) {
      const providerName = provider.name || 'Unknown Provider';
      setItemLoading('paymentProviders', providerName);

      const mutation = gql`
        mutation CreatePaymentProvider($data: PaymentProviderCreateInput!) {
          createPaymentProvider(data: $data) {
            id
            code
          }
        }
      `;
      const result = (await client.request(mutation, { data: provider })) as {
        createPaymentProvider: { id: string };
      };
      createdPaymentProviders[provider.code] = result.createPaymentProvider.id;

      setItemCompleted('paymentProviders', providerName);
    }

    return createdPaymentProviders;
  };

  const createFulfillmentProvider = async (client: GraphQLClient) => {
    setProgress('Creating fulfillment provider...');
    const createdFulfillmentProviders: Record<string, string> = {};

    const fulfillmentMutation = gql`
      mutation CreateFulfillmentProvider($data: FulfillmentProviderCreateInput!) {
        createFulfillmentProvider(data: $data) {
          id
          code
        }
      }
    `;
    const fulfillmentResult = (await client.request(fulfillmentMutation, {
      data: {
        code: 'fp_manual',
        name: 'Manual Fulfillment',
        isInstalled: true,
      },
    })) as { createFulfillmentProvider: { id: string } };
    createdFulfillmentProviders['fp_manual'] = fulfillmentResult.createFulfillmentProvider.id;

    return createdFulfillmentProviders;
  };

  const createRegions = async (
    client: GraphQLClient,
    data: any,
    createdCurrencies: Record<string, string>,
    createdPaymentProviders: Record<string, string>,
    createdFulfillmentProviders: Record<string, string>,
    createdCountries: Record<string, string>
  ) => {
    setProgress('Creating regions...');
    const createdRegions: Record<string, string> = {};

    for (const region of data.regions) {
      const filteredPaymentProviders = (region.paymentProviders?.connect || [])
        .map((p: any) => createdPaymentProviders[p.code])
        .filter(Boolean)
        .map((id: string) => ({ id }));
      const filteredFulfillmentProviders = region.fulfillmentProviders?.connect || []
        ? region.fulfillmentProviders.connect
            .map((p: any) => createdFulfillmentProviders[p.code])
            .filter(Boolean)
            .map((id: string) => ({ id }))
        : [];

      const mutation = gql`
        mutation CreateRegion($data: RegionCreateInput!) {
          createRegion(data: $data) {
            id
            code
          }
        }
      `;
      const result = (await client.request(mutation, {
        data: {
          code: region.code,
          name: region.name,
          currency: {
            connect: { id: createdCurrencies[region.currencyCode] },
          },
          taxRate: region.taxRate,
          paymentProviders: filteredPaymentProviders.length > 0
            ? { connect: filteredPaymentProviders }
            : undefined,
          fulfillmentProviders: filteredFulfillmentProviders.length > 0
            ? { connect: filteredFulfillmentProviders }
            : undefined,
          countries: {
            connect: region.countries.map((c: { iso2: string }) => ({
              id: createdCountries[c.iso2],
            })),
          },
        },
      })) as { createRegion: { id: string } };
      createdRegions[region.code] = result.createRegion.id;
    }

    return createdRegions;
  };

  const createShippingOptions = async (
    client: GraphQLClient,
    data: any,
    createdFulfillmentProviders: Record<string, string>,
    createdRegions: Record<string, string>
  ) => {
    setProgress('Creating delivery options...');

    for (const option of data.shipping_options) {
      const shippingName = option.name || 'Unknown Delivery';
      setItemLoading('shipping', shippingName);

      for (const region of data.regions) {
        const mutation = gql`
          mutation CreateShippingOption($data: ShippingOptionCreateInput!) {
            createShippingOption(data: $data) {
              id
            }
          }
        `;
        await client.request(mutation, {
          data: {
            name: option.name,
            priceType: option.priceType,
            amount: option.amount,
            isReturn: option.isReturn || false,
            uniqueKey: `${option.name}-${region.code}`,
            fulfillmentProvider: {
              connect: { id: createdFulfillmentProviders['fp_manual'] },
            },
            region: { connect: { id: createdRegions[region.code] } },
          },
        });
      }

      setItemCompleted('shipping', shippingName);
    }
  };

  const createVehicleMakes = async (client: GraphQLClient, data: any) => {
    setProgress('Creating vehicle makes...');

    for (const make of data.vehicleMakes) {
      const makeName = make.name || 'Unknown Make';
      setItemLoading('vehicleMakes', makeName);

      // Placeholder - implement actual vehicle make creation
      setItemCompleted('vehicleMakes', makeName);
    }
  };

  const createVehicleTypes = async (client: GraphQLClient, data: any) => {
    setProgress('Creating vehicle types...');

    for (const type of data.vehicleTypes) {
      const typeName = type.name || 'Unknown Type';
      setItemLoading('vehicleTypes', typeName);

      // Placeholder - implement actual vehicle type creation
      setItemCompleted('vehicleTypes', typeName);
    }
  };

  const createServices = async (client: GraphQLClient, data: any) => {
    setProgress('Creating services...');

    for (const service of data.services) {
      const serviceName = service.name || 'Unknown Service';
      setItemLoading('services', serviceName);

      // Placeholder - implement actual service creation
      setItemCompleted('services', serviceName);
    }
  };

  const createStaff = async (client: GraphQLClient, data: any) => {
    setProgress('Creating staff roles...');

    for (const staff of data.staff) {
      const staffRole = staff.role || 'Unknown Role';
      setItemLoading('staff', staffRole);

      // Placeholder - implement actual staff creation
      setItemCompleted('staff', staffRole);
    }
  };

  const handleOnboardingError = (e: any) => {
    let errorMessage = e.message || 'Unknown error';

    if (e.response?.errors) {
      errorMessage = e.response.errors
        .map((err: any) => {
          if (err.message && err.message.includes('Prisma error')) {
            try {
              if (err.message.includes('Unique constraint failed')) {
                return 'Unique constraint failed - this item already exists.';
              }

              const match = err.message.match(/\{[\s\S]*\}/);
              if (match) {
                const errorObj = JSON.parse(match[0]);
                return `Prisma error: ${errorObj.message || 'Unknown Prisma error'}`;
              }
            } catch (parseError) {
              // If parsing fails, just return the original message
            }
          }

          if (err.message) {
            return err.message.replace(/\{[\s\S]*\}/g, '[Error details omitted]');
          }

          const stringified = JSON.stringify(err, null, 2);
          return stringified.length > 500
            ? stringified.substring(0, 500) + '...'
            : stringified;
        })
        .join('\n\n');
    }

    setError(errorMessage);
    console.error('Error during onboarding:', e);

    const newItemErrors: Record<string, Record<string, string>> = {};

    for (const section of SECTION_DEFINITIONS) {
      const sectionType = section.type;
      const sectionItems = section.getItemsFn(selectedTemplate);
      const completedSectionItems = completedItems[sectionType] || [];

      const failedItem = sectionItems.find(
        (item) => !completedSectionItems.includes(item)
      );

      if (failedItem) {
        setItemError(sectionType, failedItem, errorMessage);
        break;
      }
    }
  };

  return { runOnboarding };
}
