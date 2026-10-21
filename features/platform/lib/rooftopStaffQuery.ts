export const ROOFTOP_STAFF_QUERY = `
  query EligibleRooftopStaff($rooftopId: ID!) {
    users(where: { OR: [
      { rooftopMemberships: { some: { status: { equals: "active" }, rooftop: { id: { equals: $rooftopId } } } } },
      { dealerGroupMemberships: { some: { status: { equals: "active" }, accessAllRooftops: { equals: true }, dealerGroup: { rooftops: { some: { id: { equals: $rooftopId } } } } } } }
    ] }) { id name }
  }
`
