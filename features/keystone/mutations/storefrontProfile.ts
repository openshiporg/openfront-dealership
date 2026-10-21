import { normalizeStoreLogoColor } from '../../lib/store-logo'
import { resolvePublicRooftopId } from '../tenantRecords'
import { sanitizeStoreLogoSvg } from '../../lib/sanitize-store-logo'
import { publicSubmissionRooftopSlug } from './publicSubmissionPolicy'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function phoneHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : ''
}

export async function storefrontProfile(
  _root: unknown,
  { rooftopSlug }: { rooftopSlug?: string | null },
  context: any
) {
  const publicSlug = await publicSubmissionRooftopSlug(context, rooftopSlug)
  const rooftopId = await resolvePublicRooftopId(context, publicSlug)
  const rooftop = await context.sudo().prisma.rooftop.findUnique({ where: { id: rooftopId }, select: { timezone: true } })
  const profile = await context.sudo().query.DealershipProfile.findOne({
    where: { id: 1 },
    query: `
      id name shortName salesEmail serviceEmail phone
      addressLine1 addressLine2 city state postalCode
      hoursMonFri hoursSaturday hoursSunday websiteUrl currencyCode
      homepageTitle homepageDescription logoIcon logoColor
    `,
  })

  const fullName = text(profile?.name)
  const shortName = text(profile?.shortName)
  const phone = text(profile?.phone)
  const locality = [profile?.city, profile?.state, profile?.postalCode]
    .map(text)
    .filter(Boolean)
    .join(', ')

  return {
    configured: Boolean(profile && fullName && shortName),
    rooftopId,
    rooftopSlug: publicSlug,
    fullName,
    shortName,
    salesEmail: text(profile?.salesEmail),
    serviceEmail: text(profile?.serviceEmail),
    phoneDisplay: phone,
    phoneHref: phoneHref(phone),
    addressLine1: text(profile?.addressLine1),
    addressLine2: [text(profile?.addressLine2), locality].filter(Boolean).join(' · '),
    hoursMonFri: text(profile?.hoursMonFri),
    hoursSaturday: text(profile?.hoursSaturday),
    hoursSunday: text(profile?.hoursSunday),
    websiteUrl: text(profile?.websiteUrl),
    currencyCode: text(profile?.currencyCode).toUpperCase(),
    homepageTitle: text(profile?.homepageTitle),
    homepageDescription: text(profile?.homepageDescription),
    logoIcon: sanitizeStoreLogoSvg(text(profile?.logoIcon)),
    logoColor: normalizeStoreLogoColor(profile?.logoColor),
    timezone: text(rooftop?.timezone),
  }
}
