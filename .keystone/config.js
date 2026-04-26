"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core22 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/User.ts
var import_core = require("@keystone-6/core");
var import_access = require("@keystone-6/core/access");
var import_fields = require("@keystone-6/core/fields");

// features/keystone/access.ts
function isSignedIn({ session }) {
  return Boolean(session);
}
var permissions = {
  canCreateTodos: ({ session }) => session?.data.role?.canCreateTodos ?? false,
  canManageAllTodos: ({ session }) => session?.data.role?.canManageAllTodos ?? false,
  canManagePeople: ({ session }) => session?.data.role?.canManagePeople ?? false,
  canManageRoles: ({ session }) => session?.data.role?.canManageRoles ?? false,
  canAccessDashboard: ({ session }) => session?.data.role?.canAccessDashboard ?? false
};
var rules = {
  canReadTodos: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canManageAllTodos) {
      return {
        OR: [
          { assignedTo: { id: { equals: session.itemId } } },
          { assignedTo: null, isPrivate: { equals: true } },
          { NOT: { isPrivate: { equals: true } } }
        ]
      };
    }
    return { assignedTo: { id: { equals: session.itemId } } };
  },
  canManageTodos: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canManageAllTodos) return true;
    return { assignedTo: { id: { equals: session.itemId } } };
  },
  canReadPeople: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canSeeOtherPeople) return true;
    return { id: { equals: session.itemId } };
  },
  canUpdatePeople: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canEditOtherPeople) return true;
    return { id: { equals: session.itemId } };
  }
};

// features/keystone/models/User.ts
var User = (0, import_core.list)({
  access: {
    operation: {
      query: () => true,
      create: (args) => {
        if (process.env.PUBLIC_SIGNUPS_ALLOWED === "true") {
          return true;
        }
        return permissions.canManagePeople(args);
      },
      update: isSignedIn,
      delete: permissions.canManagePeople
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManagePeople(args),
    hideDelete: (args) => !permissions.canManagePeople(args),
    listView: {
      initialColumns: ["name", "email", "role", "assignedLeads"]
    },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.data.role?.canEditOtherPeople) return "edit";
        if (session?.itemId === item?.id) return "edit";
        return "read";
      }
    }
  },
  fields: {
    // Basic Info
    name: (0, import_fields.text)({
      validation: {
        isRequired: true
      }
    }),
    email: (0, import_fields.text)({
      isFilterable: false,
      isOrderable: false,
      isIndexed: "unique",
      validation: {
        isRequired: true
      }
    }),
    password: (0, import_fields.password)({
      access: {
        read: import_access.denyAll,
        update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id
      },
      validation: { isRequired: true }
    }),
    role: (0, import_fields.relationship)({
      ref: "Role.assignedTo",
      access: {
        create: permissions.canManagePeople,
        update: permissions.canManagePeople
      },
      ui: {
        itemView: {
          fieldMode: (args) => permissions.canManagePeople(args) ? "edit" : "read"
        }
      }
    }),
    // Dealership-specific fields
    phone: (0, import_fields.text)({
      label: "Phone Number",
      ui: {
        description: "Contact phone number"
      }
    }),
    employeeId: (0, import_fields.text)({
      label: "Employee ID",
      isIndexed: "unique",
      ui: {
        description: "Internal employee identifier"
      }
    }),
    commissionRate: (0, import_fields.float)({
      label: "Commission Rate (%)",
      defaultValue: 0,
      ui: {
        description: "Sales commission percentage (e.g., 10 for 10%)"
      }
    }),
    isSalesperson: (0, import_fields.checkbox)({
      defaultValue: false,
      label: "Is Salesperson",
      ui: {
        description: "Whether this user is a salesperson"
      }
    }),
    isServiceAdvisor: (0, import_fields.checkbox)({
      defaultValue: false,
      label: "Is Service Advisor",
      ui: {
        description: "Whether this user is a service advisor"
      }
    }),
    isFinanceManager: (0, import_fields.checkbox)({
      defaultValue: false,
      label: "Is Finance Manager",
      ui: {
        description: "Whether this user handles financing"
      }
    }),
    // Dealership relationships
    assignedLeads: (0, import_fields.relationship)({
      ref: "Lead.assignedSalesperson",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Assigned Leads"
    }),
    deals: (0, import_fields.relationship)({
      ref: "Deal.salesperson",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Deals"
    }),
    // Service appointments (as customer)
    customerAppointments: (0, import_fields.relationship)({
      ref: "ServiceAppointment.customer",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Service Appointments (Customer)"
    }),
    // Service appointments (as technician)
    techAppointments: (0, import_fields.relationship)({
      ref: "ServiceAppointment.assignedTech",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Service Appointments (Technician)"
    }),
    // Price changes made by this user
    priceChanges: (0, import_fields.relationship)({
      ref: "PriceHistory.changedBy",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Price Changes"
    }),
    // Customer interactions performed
    interactions: (0, import_fields.relationship)({
      ref: "CustomerInteraction.performedBy",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Customer Interactions"
    }),
    // Tasks assigned to this user
    tasks: (0, import_fields.relationship)({
      ref: "Task.assignedTo",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Tasks"
    }),
    // Deal approvals performed
    dealApprovals: (0, import_fields.relationship)({
      ref: "DealApproval.approver",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Deal Approvals"
    })
  }
});

// features/keystone/models/Role.ts
var import_core2 = require("@keystone-6/core");
var import_access3 = require("@keystone-6/core/access");
var import_fields2 = require("@keystone-6/core/fields");
var Role = (0, import_core2.list)({
  access: {
    operation: {
      ...(0, import_access3.allOperations)(permissions.canManageRoles),
      query: () => true
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: (args) => !permissions.canManageRoles(args),
    listView: {
      initialColumns: ["name", "assignedTo"]
    },
    itemView: {
      defaultFieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read"
    }
  },
  fields: {
    name: (0, import_fields2.text)({ validation: { isRequired: true } }),
    // General permissions
    canSeeOtherPeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canEditOtherPeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canManagePeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canManageRoles: (0, import_fields2.checkbox)({ defaultValue: false }),
    canAccessDashboard: (0, import_fields2.checkbox)({ defaultValue: false }),
    // Dealership-specific permissions
    canManageInventory: (0, import_fields2.checkbox)({
      defaultValue: false,
      label: "Can Manage Inventory",
      ui: {
        description: "Can add, edit, and delete vehicles in inventory"
      }
    }),
    canViewInventory: (0, import_fields2.checkbox)({
      defaultValue: true,
      label: "Can View Inventory",
      ui: {
        description: "Can view vehicle inventory"
      }
    }),
    canManageLeads: (0, import_fields2.checkbox)({
      defaultValue: false,
      label: "Can Manage Leads",
      ui: {
        description: "Can create, edit, and assign leads"
      }
    }),
    canViewAllLeads: (0, import_fields2.checkbox)({
      defaultValue: false,
      label: "Can View All Leads",
      ui: {
        description: "Can view leads assigned to others"
      }
    }),
    canManageDeals: (0, import_fields2.checkbox)({
      defaultValue: false,
      label: "Can Manage Deals",
      ui: {
        description: "Can create, edit, and close deals"
      }
    }),
    canApproveDeals: (0, import_fields2.checkbox)({
      defaultValue: false,
      label: "Can Approve Deals",
      ui: {
        description: "Can approve deals above certain thresholds"
      }
    }),
    canManageService: (0, import_fields2.checkbox)({
      defaultValue: false,
      label: "Can Manage Service",
      ui: {
        description: "Can manage service appointments and orders"
      }
    }),
    canViewReports: (0, import_fields2.checkbox)({
      defaultValue: false,
      label: "Can View Reports",
      ui: {
        description: "Can view sales and inventory reports"
      }
    }),
    canManageFinancing: (0, import_fields2.checkbox)({
      defaultValue: false,
      label: "Can Manage Financing",
      ui: {
        description: "Can manage financing options and approvals"
      }
    }),
    canManageTradeIns: (0, import_fields2.checkbox)({
      defaultValue: false,
      label: "Can Manage Trade-Ins",
      ui: {
        description: "Can appraise and manage trade-in vehicles"
      }
    }),
    // Relationship to users
    assignedTo: (0, import_fields2.relationship)({
      ref: "User.role",
      many: true,
      ui: {
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// features/keystone/models/Make.ts
var import_core3 = require("@keystone-6/core");
var import_fields3 = require("@keystone-6/core/fields");
var Make = (0, import_core3.list)({
  access: {
    operation: {
      query: () => true,
      // Allow public access
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "models"]
    }
  },
  fields: {
    name: (0, import_fields3.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      label: "Make Name",
      ui: {
        description: "Vehicle manufacturer name (e.g., Toyota, Honda, Ford)"
      }
    }),
    logo: (0, import_fields3.image)({
      storage: "my_images",
      label: "Logo",
      ui: {
        description: "Manufacturer logo image"
      }
    }),
    // Relationships
    models: (0, import_fields3.relationship)({
      ref: "Model.make",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "bodyStyle"],
        inlineCreate: { fields: ["name", "bodyStyle", "baseYear"] },
        inlineEdit: { fields: ["name", "bodyStyle", "baseYear"] },
        inlineConnect: true
      },
      label: "Models"
    })
  }
});

// features/keystone/models/Model.ts
var import_core4 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
var Model = (0, import_core4.list)({
  access: {
    operation: {
      query: () => true,
      // Allow public access
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "make", "bodyStyle", "baseYear"]
    },
    labelField: "name"
  },
  fields: {
    name: (0, import_fields4.text)({
      validation: { isRequired: true },
      label: "Model Name",
      ui: {
        description: "Vehicle model name (e.g., Camry, Accord, F-150)"
      }
    }),
    make: (0, import_fields4.relationship)({
      ref: "Make.models",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Make"
    }),
    bodyStyle: (0, import_fields4.select)({
      type: "string",
      options: [
        { label: "Sedan", value: "sedan" },
        { label: "SUV", value: "suv" },
        { label: "Truck", value: "truck" },
        { label: "Coupe", value: "coupe" },
        { label: "Hatchback", value: "hatchback" },
        { label: "Convertible", value: "convertible" },
        { label: "Wagon", value: "wagon" },
        { label: "Van", value: "van" },
        { label: "Minivan", value: "minivan" }
      ],
      label: "Body Style",
      ui: {
        description: "Vehicle body style category"
      }
    }),
    baseYear: (0, import_fields4.integer)({
      label: "Base Year",
      ui: {
        description: "Year when this model was first introduced"
      }
    })
  }
});

// features/keystone/models/Vehicle.ts
var import_core5 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var Vehicle = (0, import_core5.list)({
  access: {
    operation: {
      query: () => true,
      // Allow public access to browse inventory
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["vin", "year", "make", "model", "status", "price"]
    },
    labelField: "vin"
  },
  fields: {
    // Vehicle Identification
    vin: (0, import_fields5.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      label: "VIN",
      ui: {
        description: "Vehicle Identification Number (17 characters)"
      }
    }),
    stockNumber: (0, import_fields5.text)({
      isIndexed: "unique",
      label: "Stock Number",
      ui: {
        description: "Internal stock number for inventory tracking"
      }
    }),
    // Vehicle Details
    year: (0, import_fields5.integer)({
      validation: { isRequired: true },
      label: "Year"
    }),
    make: (0, import_fields5.text)({
      validation: { isRequired: true },
      label: "Make",
      ui: {
        description: "Vehicle manufacturer (e.g., Toyota, Honda, Ford)"
      }
    }),
    model: (0, import_fields5.text)({
      validation: { isRequired: true },
      label: "Model",
      ui: {
        description: "Vehicle model name (e.g., Camry, Civic, F-150)"
      }
    }),
    trim: (0, import_fields5.text)({
      label: "Trim",
      ui: {
        description: "Trim level (e.g., LX, EX, Sport)"
      }
    }),
    exteriorColor: (0, import_fields5.text)({
      label: "Exterior Color",
      ui: {
        description: "Exterior paint color"
      }
    }),
    interiorColor: (0, import_fields5.text)({
      label: "Interior Color",
      ui: {
        description: "Interior upholstery color"
      }
    }),
    mileage: (0, import_fields5.integer)({
      label: "Mileage",
      ui: {
        description: "Current odometer reading"
      }
    }),
    // Pricing
    purchasePrice: (0, import_fields5.float)({
      label: "Purchase Price",
      ui: {
        description: "Cost to acquire vehicle (dealer cost)"
      }
    }),
    listPrice: (0, import_fields5.float)({
      label: "List Price",
      ui: {
        description: "Current listing price (sale price)"
      }
    }),
    price: (0, import_fields5.float)({
      label: "Price",
      ui: {
        description: "Alias for listPrice - for backward compatibility"
      }
    }),
    // Condition and Status
    condition: (0, import_fields5.select)({
      type: "string",
      options: [
        { label: "New", value: "new" },
        { label: "Used", value: "used" },
        { label: "Certified", value: "certified" }
      ],
      label: "Condition",
      ui: {
        description: "Vehicle condition category"
      }
    }),
    status: (0, import_fields5.select)({
      type: "string",
      options: [
        { label: "Available", value: "available" },
        { label: "Pending", value: "pending" },
        { label: "Sold", value: "sold" },
        { label: "Service", value: "service" }
      ],
      defaultValue: "available",
      label: "Status",
      ui: {
        description: "Current availability status"
      }
    }),
    // Features and Description
    description: (0, import_fields5.text)({
      ui: {
        displayMode: "textarea",
        description: "Marketing description for listings"
      },
      label: "Description"
    }),
    features: (0, import_fields5.json)({
      defaultValue: [],
      label: "Features",
      ui: {
        description: "JSON array of vehicle features and options"
      }
    }),
    metadata: (0, import_fields5.json)({
      defaultValue: {},
      label: "Metadata",
      ui: {
        description: "Additional vehicle specifications and data (engine, transmission, etc.)"
      }
    }),
    // Images
    images: (0, import_fields5.relationship)({
      ref: "VehicleImage.vehicle",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["image", "caption", "isPrimary", "sortOrder"],
        inlineCreate: { fields: ["image", "caption", "isPrimary", "sortOrder"] },
        inlineEdit: { fields: ["image", "caption", "isPrimary", "sortOrder"] }
      },
      label: "Gallery Images"
    }),
    // Relationships
    deals: (0, import_fields5.relationship)({
      ref: "Deal.vehicle",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Deals"
    }),
    leads: (0, import_fields5.relationship)({
      ref: "Lead.interestedVehicle",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Interested Leads"
    }),
    testDrives: (0, import_fields5.relationship)({
      ref: "TestDrive.vehicle",
      many: true,
      ui: {
        displayMode: "count"
      },
      label: "Test Drives"
    }),
    conditionReports: (0, import_fields5.relationship)({
      ref: "VehicleConditionReport.vehicle",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["reportDate", "overallCondition", "inspector"],
        inlineCreate: { fields: ["reportDate", "inspector", "overallCondition"] }
      },
      label: "Condition Reports"
    }),
    history: (0, import_fields5.relationship)({
      ref: "VehicleHistory.vehicle",
      ui: {
        displayMode: "cards",
        cardFields: ["acquisitionDate", "previousOwners", "hasAccidents"]
      },
      label: "Vehicle History"
    }),
    priceHistory: (0, import_fields5.relationship)({
      ref: "PriceHistory.vehicle",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["effectiveDate", "previousPrice", "newPrice", "changeReason"]
      },
      label: "Price History"
    }),
    // Timestamps
    createdAt: (0, import_fields5.timestamp)({
      defaultValue: { kind: "now" },
      label: "Created At",
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// features/keystone/models/VehicleImage.ts
var import_core6 = require("@keystone-6/core");
var import_fields6 = require("@keystone-6/core/fields");
var VehicleImage = (0, import_core6.list)({
  access: {
    operation: {
      query: () => true,
      // Allow public access to view vehicle images
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["vehicle", "caption", "isPrimary", "sortOrder"]
    },
    labelField: "caption"
  },
  fields: {
    // Vehicle relationship
    vehicle: (0, import_fields6.relationship)({
      ref: "Vehicle.images",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    // Image
    image: (0, import_fields6.image)({
      storage: "my_images",
      label: "Image"
    }),
    // Caption
    caption: (0, import_fields6.text)({
      label: "Caption",
      ui: {
        description: "Description or caption for this image"
      }
    }),
    // Category
    category: (0, import_fields6.select)({
      type: "string",
      options: [
        { label: "Exterior", value: "exterior" },
        { label: "Interior", value: "interior" },
        { label: "Engine", value: "engine" },
        { label: "Damage", value: "damage" }
      ],
      defaultValue: "exterior",
      label: "Category",
      ui: {
        description: "Type of image"
      }
    }),
    // Sort order
    sortOrder: (0, import_fields6.integer)({
      defaultValue: 0,
      label: "Sort Order",
      ui: {
        description: "Order in which images appear in gallery (lower = first)"
      }
    }),
    // Primary image flag
    isPrimary: (0, import_fields6.checkbox)({
      defaultValue: false,
      label: "Primary Image",
      ui: {
        description: "Set as the main display image for this vehicle"
      }
    })
  }
});

// features/keystone/models/VehicleConditionReport.ts
var import_core7 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");
var VehicleConditionReport = (0, import_core7.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["vehicle", "reportDate", "inspector", "overallCondition"]
    },
    labelField: "reportDate"
  },
  fields: {
    // Vehicle relationship
    vehicle: (0, import_fields7.relationship)({
      ref: "Vehicle.conditionReports",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    // Report Details
    reportDate: (0, import_fields7.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
      label: "Report Date"
    }),
    inspector: (0, import_fields7.text)({
      label: "Inspector",
      ui: {
        description: "Name of person who performed inspection"
      }
    }),
    // Condition Ratings
    overallCondition: (0, import_fields7.select)({
      type: "string",
      options: [
        { label: "Excellent", value: "excellent" },
        { label: "Good", value: "good" },
        { label: "Fair", value: "fair" },
        { label: "Poor", value: "poor" }
      ],
      label: "Overall Condition"
    }),
    mechanicalRating: (0, import_fields7.select)({
      type: "string",
      options: [
        { label: "Excellent", value: "excellent" },
        { label: "Good", value: "good" },
        { label: "Fair", value: "fair" },
        { label: "Poor", value: "poor" }
      ],
      label: "Mechanical Rating",
      ui: {
        description: "Engine, transmission, drivetrain condition"
      }
    }),
    bodyRating: (0, import_fields7.select)({
      type: "string",
      options: [
        { label: "Excellent", value: "excellent" },
        { label: "Good", value: "good" },
        { label: "Fair", value: "fair" },
        { label: "Poor", value: "poor" }
      ],
      label: "Body Rating",
      ui: {
        description: "Exterior body and paint condition"
      }
    }),
    interiorRating: (0, import_fields7.select)({
      type: "string",
      options: [
        { label: "Excellent", value: "excellent" },
        { label: "Good", value: "good" },
        { label: "Fair", value: "fair" },
        { label: "Poor", value: "poor" }
      ],
      label: "Interior Rating",
      ui: {
        description: "Seats, dashboard, carpet condition"
      }
    }),
    // Issues and Repairs
    issues: (0, import_fields7.json)({
      defaultValue: [],
      label: "Issues",
      ui: {
        description: "JSON array of identified issues [{description, severity, location}]"
      }
    }),
    estimatedRepairs: (0, import_fields7.integer)({
      label: "Estimated Repair Cost",
      ui: {
        description: "Estimated cost to address identified issues"
      }
    }),
    // Notes
    notes: (0, import_fields7.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional inspection notes"
      },
      label: "Notes"
    })
  }
});

// features/keystone/models/VehicleHistory.ts
var import_core8 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
var VehicleHistory = (0, import_core8.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["vehicle", "acquisitionDate", "previousOwners", "hasAccidents"]
    }
  },
  fields: {
    // Vehicle relationship
    vehicle: (0, import_fields8.relationship)({
      ref: "Vehicle.history",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    // Acquisition Details
    acquisitionDate: (0, import_fields8.timestamp)({
      label: "Acquisition Date",
      ui: {
        description: "Date vehicle was acquired by dealership"
      }
    }),
    acquisitionSource: (0, import_fields8.text)({
      label: "Acquisition Source",
      ui: {
        description: "Where vehicle was acquired (trade-in, auction, etc.)"
      }
    }),
    // Ownership History
    previousOwners: (0, import_fields8.integer)({
      label: "Previous Owners",
      ui: {
        description: "Number of previous owners"
      }
    }),
    hasAccidents: (0, import_fields8.checkbox)({
      defaultValue: false,
      label: "Has Accidents",
      ui: {
        description: "Vehicle has been in one or more accidents"
      }
    }),
    accidentDetails: (0, import_fields8.text)({
      ui: {
        displayMode: "textarea",
        description: "Details of any accidents or damage history"
      },
      label: "Accident Details"
    }),
    // Service History
    serviceRecords: (0, import_fields8.text)({
      ui: {
        displayMode: "textarea",
        description: "Summary of known service history"
      },
      label: "Service Records"
    }),
    // Title Information
    titleStatus: (0, import_fields8.text)({
      label: "Title Status",
      ui: {
        description: "Clean, Salvage, Rebuilt, etc."
      }
    }),
    // Notes
    notes: (0, import_fields8.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional history notes"
      },
      label: "Notes"
    })
  }
});

// features/keystone/models/PriceHistory.ts
var import_core9 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var PriceHistory = (0, import_core9.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["vehicle", "effectiveDate", "previousPrice", "newPrice", "changeReason"]
    }
  },
  fields: {
    // Vehicle relationship
    vehicle: (0, import_fields9.relationship)({
      ref: "Vehicle.priceHistory",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    // Price Change Details
    effectiveDate: (0, import_fields9.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
      label: "Effective Date",
      ui: {
        description: "Date when price change took effect"
      }
    }),
    previousPrice: (0, import_fields9.float)({
      label: "Previous Price",
      ui: {
        description: "Price before this change"
      }
    }),
    newPrice: (0, import_fields9.float)({
      validation: { isRequired: true },
      label: "New Price",
      ui: {
        description: "Price after this change"
      }
    }),
    // Change Reason
    changeReason: (0, import_fields9.text)({
      label: "Change Reason",
      ui: {
        description: "Reason for price change (e.g., Market adjustment, Special pricing, Aged inventory)"
      }
    }),
    // Changed By
    changedBy: (0, import_fields9.relationship)({
      ref: "User.priceChanges",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Changed By"
    }),
    // Notes
    notes: (0, import_fields9.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional notes about price change"
      },
      label: "Notes"
    })
  }
});

// features/keystone/models/Lead.ts
var import_core10 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");
var Lead = (0, import_core10.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: () => true,
      // Allow public lead creation from storefront forms
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["firstName", "lastName", "status", "source", "assignedSalesperson", "createdAt"]
    }
  },
  fields: {
    // Contact Information
    firstName: (0, import_fields10.text)({
      validation: { isRequired: true },
      label: "First Name"
    }),
    lastName: (0, import_fields10.text)({
      validation: { isRequired: true },
      label: "Last Name"
    }),
    email: (0, import_fields10.text)({
      label: "Email"
    }),
    phone: (0, import_fields10.text)({
      label: "Phone"
    }),
    // Lead Source
    source: (0, import_fields10.select)({
      type: "string",
      options: [
        { label: "Walk-In", value: "walk-in" },
        { label: "Website", value: "website" },
        { label: "Phone", value: "phone" },
        { label: "Referral", value: "referral" },
        { label: "Advertisement", value: "ad" },
        { label: "Social Media", value: "social" },
        { label: "Third Party", value: "third-party" }
      ],
      label: "Source",
      ui: {
        description: "How the lead found the dealership"
      }
    }),
    // Vehicle Interest
    interestedVehicle: (0, import_fields10.relationship)({
      ref: "Vehicle.leads",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Interested Vehicle"
    }),
    budgetRange: (0, import_fields10.select)({
      type: "string",
      options: [
        { label: "Under $20,000", value: "under-20k" },
        { label: "$20,000 - $30,000", value: "20-30k" },
        { label: "$30,000 - $40,000", value: "30-40k" },
        { label: "$40,000 - $50,000", value: "40-50k" },
        { label: "$50,000 - $75,000", value: "50-75k" },
        { label: "$75,000 - $100,000", value: "75-100k" },
        { label: "Over $100,000", value: "over-100k" }
      ],
      label: "Budget Range"
    }),
    tradeInVehicle: (0, import_fields10.text)({
      label: "Trade-In Vehicle",
      ui: {
        description: "Description of vehicle they want to trade in"
      }
    }),
    // Timeline
    timeframe: (0, import_fields10.select)({
      type: "string",
      options: [
        { label: "Immediately", value: "immediately" },
        { label: "This Week", value: "this-week" },
        { label: "This Month", value: "this-month" },
        { label: "Just Looking", value: "just-looking" }
      ],
      label: "Purchase Timeframe"
    }),
    // Status
    status: (0, import_fields10.select)({
      type: "string",
      options: [
        { label: "New", value: "new" },
        { label: "Contacted", value: "contacted" },
        { label: "Test Drive Scheduled", value: "test-drive-scheduled" },
        { label: "Negotiating", value: "negotiating" },
        { label: "Closed - Won", value: "closed-won" },
        { label: "Closed - Lost", value: "closed-lost" }
      ],
      defaultValue: "new",
      label: "Status"
    }),
    // Assignment
    assignedSalesperson: (0, import_fields10.relationship)({
      ref: "User.assignedLeads",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Assigned Salesperson"
    }),
    // Notes
    notes: (0, import_fields10.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional notes about the lead"
      },
      label: "Notes"
    }),
    // Timestamps
    createdAt: (0, import_fields10.timestamp)({
      defaultValue: { kind: "now" },
      label: "Created At",
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    lastContact: (0, import_fields10.timestamp)({
      label: "Last Contact",
      ui: {
        description: "Last time this lead was contacted"
      }
    }),
    // Relationships
    testDrives: (0, import_fields10.relationship)({
      ref: "TestDrive.lead",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["vehicle", "scheduledTime", "completed"],
        inlineCreate: { fields: ["vehicle", "scheduledTime"] },
        inlineConnect: true
      },
      label: "Test Drives"
    }),
    deals: (0, import_fields10.relationship)({
      ref: "Deal.lead",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["vehicle", "status", "vehiclePrice"]
      },
      label: "Deals"
    }),
    interactions: (0, import_fields10.relationship)({
      ref: "CustomerInteraction.lead",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["interactionType", "date", "outcome", "followUpDate"],
        inlineCreate: { fields: ["interactionType", "date", "notes"] }
      },
      label: "Interactions"
    }),
    tasks: (0, import_fields10.relationship)({
      ref: "Task.lead",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["title", "dueDate", "priority", "completed"],
        inlineCreate: { fields: ["title", "dueDate", "priority"] }
      },
      label: "Tasks"
    })
  }
});

// features/keystone/models/CustomerInteraction.ts
var import_core11 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var CustomerInteraction = (0, import_core11.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["lead", "interactionType", "date", "outcome", "followUpDate"]
    }
  },
  fields: {
    // Lead relationship
    lead: (0, import_fields11.relationship)({
      ref: "Lead.interactions",
      ui: {
        displayMode: "select"
      },
      label: "Lead"
    }),
    // Interaction Details
    interactionType: (0, import_fields11.select)({
      type: "string",
      options: [
        { label: "Phone Call", value: "phone" },
        { label: "Email", value: "email" },
        { label: "In-Person Visit", value: "visit" },
        { label: "Test Drive", value: "test-drive" },
        { label: "Text Message", value: "sms" },
        { label: "Video Call", value: "video" }
      ],
      validation: { isRequired: true },
      label: "Interaction Type"
    }),
    date: (0, import_fields11.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
      label: "Date"
    }),
    duration: (0, import_fields11.integer)({
      label: "Duration (Minutes)",
      ui: {
        description: "How long the interaction lasted"
      }
    }),
    // Content
    notes: (0, import_fields11.text)({
      ui: {
        displayMode: "textarea",
        description: "Detailed notes about the interaction"
      },
      label: "Notes"
    }),
    // Outcome
    outcome: (0, import_fields11.select)({
      type: "string",
      options: [
        { label: "Positive", value: "positive" },
        { label: "Neutral", value: "neutral" },
        { label: "Negative", value: "negative" },
        { label: "No Answer", value: "no-answer" },
        { label: "Left Voicemail", value: "voicemail" }
      ],
      label: "Outcome"
    }),
    // Follow-up
    followUpDate: (0, import_fields11.timestamp)({
      label: "Follow-Up Date",
      ui: {
        description: "When to follow up next"
      }
    }),
    followUpCompleted: (0, import_fields11.timestamp)({
      label: "Follow-Up Completed",
      ui: {
        description: "When the follow-up was actually completed"
      }
    }),
    // User who performed interaction
    performedBy: (0, import_fields11.relationship)({
      ref: "User.interactions",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Performed By"
    })
  }
});

// features/keystone/models/Task.ts
var import_core12 = require("@keystone-6/core");
var import_fields12 = require("@keystone-6/core/fields");
var Task = (0, import_core12.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["title", "assignedTo", "dueDate", "priority", "completed"]
    },
    labelField: "title"
  },
  fields: {
    // Task Details
    title: (0, import_fields12.text)({
      validation: { isRequired: true },
      label: "Title"
    }),
    description: (0, import_fields12.text)({
      ui: {
        displayMode: "textarea"
      },
      label: "Description"
    }),
    // Assignment
    assignedTo: (0, import_fields12.relationship)({
      ref: "User.tasks",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Assigned To"
    }),
    // Related Lead
    lead: (0, import_fields12.relationship)({
      ref: "Lead.tasks",
      ui: {
        displayMode: "select"
      },
      label: "Related Lead"
    }),
    // Priority and Status
    priority: (0, import_fields12.select)({
      type: "string",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
        { label: "Urgent", value: "urgent" }
      ],
      defaultValue: "medium",
      label: "Priority"
    }),
    completed: (0, import_fields12.checkbox)({
      defaultValue: false,
      label: "Completed"
    }),
    // Dates
    dueDate: (0, import_fields12.timestamp)({
      label: "Due Date"
    }),
    completedDate: (0, import_fields12.timestamp)({
      label: "Completed Date",
      ui: {
        description: "When task was marked complete"
      }
    }),
    createdAt: (0, import_fields12.timestamp)({
      defaultValue: { kind: "now" },
      label: "Created At",
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// features/keystone/models/TestDrive.ts
var import_core13 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var TestDrive = (0, import_core13.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: () => true,
      // Allow public test drive scheduling from storefront
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["lead", "vehicle", "scheduledTime", "salesperson", "completed"]
    }
  },
  fields: {
    // Relationships
    lead: (0, import_fields13.relationship)({
      ref: "Lead.testDrives",
      ui: {
        displayMode: "select"
      },
      label: "Lead"
    }),
    vehicle: (0, import_fields13.relationship)({
      ref: "Vehicle.testDrives",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    salesperson: (0, import_fields13.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Salesperson"
    }),
    // Scheduling
    scheduledTime: (0, import_fields13.timestamp)({
      label: "Scheduled Time",
      validation: { isRequired: true }
    }),
    // Status
    completed: (0, import_fields13.checkbox)({
      defaultValue: false,
      label: "Completed"
    }),
    driverLicenseVerified: (0, import_fields13.checkbox)({
      defaultValue: false,
      label: "Driver License Verified",
      ui: {
        description: "Confirm license was checked before test drive"
      }
    }),
    // Feedback
    feedback: (0, import_fields13.text)({
      ui: {
        displayMode: "textarea",
        description: "Customer feedback after the test drive"
      },
      label: "Feedback"
    }),
    interestedLevel: (0, import_fields13.select)({
      type: "string",
      options: [
        { label: "Not Interested", value: "not-interested" },
        { label: "Maybe", value: "maybe" },
        { label: "Very Interested", value: "very-interested" }
      ],
      label: "Interest Level",
      ui: {
        description: "Customer interest level after test drive"
      }
    })
  }
});

// features/keystone/models/Deal.ts
var import_core14 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
var import_schema = require("@graphql-ts/schema");
var Deal = (0, import_core14.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["lead", "vehicle", "salesperson", "vehiclePrice", "status", "saleDate"]
    }
  },
  fields: {
    // Core Relationships
    lead: (0, import_fields14.relationship)({
      ref: "Lead.deals",
      ui: {
        displayMode: "select"
      },
      label: "Lead"
    }),
    vehicle: (0, import_fields14.relationship)({
      ref: "Vehicle.deals",
      ui: {
        displayMode: "select",
        labelField: "vin"
      },
      label: "Vehicle"
    }),
    salesperson: (0, import_fields14.relationship)({
      ref: "User.deals",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Salesperson"
    }),
    // Pricing
    vehiclePrice: (0, import_fields14.float)({
      label: "Negotiated Price",
      ui: {
        description: "Final negotiated vehicle price"
      }
    }),
    tradeInValue: (0, import_fields14.float)({
      label: "Trade-In Value",
      ui: {
        description: "Value credited for trade-in vehicle"
      }
    }),
    tradeInVehicle: (0, import_fields14.relationship)({
      ref: "TradeIn.deal",
      ui: {
        displayMode: "select"
      },
      label: "Trade-In Vehicle"
    }),
    tradeInDetails: (0, import_fields14.json)({
      defaultValue: {},
      label: "Trade-In Details",
      ui: {
        description: "Additional trade-in vehicle details (year, make, model, VIN)"
      }
    }),
    // Financing
    downPayment: (0, import_fields14.float)({
      label: "Down Payment"
    }),
    financingAmount: (0, import_fields14.float)({
      label: "Financing Amount",
      ui: {
        description: "Total amount being financed"
      }
    }),
    monthlyPayment: (0, import_fields14.float)({
      label: "Monthly Payment"
    }),
    loanTerm: (0, import_fields14.integer)({
      label: "Loan Term (Months)",
      ui: {
        description: "Number of months for loan"
      }
    }),
    apr: (0, import_fields14.float)({
      label: "APR (%)",
      ui: {
        description: "Annual Percentage Rate"
      }
    }),
    // Status
    status: (0, import_fields14.select)({
      type: "string",
      options: [
        { label: "Pencil (Draft)", value: "pencil" },
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
        { label: "Financed", value: "financed" },
        { label: "Delivered", value: "delivered" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "pencil",
      label: "Status"
    }),
    // Taxes and Fees
    taxAmount: (0, import_fields14.float)({
      label: "Tax Amount",
      ui: {
        description: "Sales tax on the vehicle"
      }
    }),
    fees: (0, import_fields14.json)({
      defaultValue: [],
      label: "Fees",
      ui: {
        description: "JSON array of fees [{name, amount, description}]"
      }
    }),
    // Approvals
    approvals: (0, import_fields14.relationship)({
      ref: "DealApproval.deal",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["approver", "decision", "approvalDate", "notes"],
        inlineCreate: { fields: ["approver", "decision", "notes"] }
      },
      label: "Approvals"
    }),
    // Timestamps
    saleDate: (0, import_fields14.timestamp)({
      label: "Sale Date",
      ui: {
        description: "Date the sale was completed"
      }
    }),
    createdAt: (0, import_fields14.timestamp)({
      defaultValue: { kind: "now" },
      label: "Created At",
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields14.timestamp)({
      db: { updatedAt: true },
      label: "Updated At",
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    // Virtual Fields for Calculations
    totalPrice: (0, import_fields14.virtual)({
      field: import_schema.graphql.field({
        type: import_schema.graphql.Float,
        async resolve(item) {
          const vehiclePrice = item.vehiclePrice || 0;
          const tradeInValue = item.tradeInValue || 0;
          const taxAmount = item.taxAmount || 0;
          let feesTotal = 0;
          if (item.fees && Array.isArray(item.fees)) {
            feesTotal = item.fees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
          }
          return vehiclePrice - tradeInValue + taxAmount + feesTotal;
        }
      }),
      ui: {
        listView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    profit: (0, import_fields14.virtual)({
      field: import_schema.graphql.field({
        type: import_schema.graphql.Float,
        async resolve(item, args, context) {
          if (!item.vehicleId) return null;
          const vehicle = await context.query.Vehicle.findOne({
            where: { id: item.vehicleId },
            query: "purchasePrice"
          });
          if (!vehicle?.purchasePrice) return null;
          const vehiclePrice = item.vehiclePrice || 0;
          const purchasePrice = vehicle.purchasePrice || 0;
          return vehiclePrice - purchasePrice;
        }
      }),
      ui: {
        listView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// features/keystone/models/DealApproval.ts
var import_core15 = require("@keystone-6/core");
var import_fields15 = require("@keystone-6/core/fields");
var DealApproval = (0, import_core15.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["deal", "approver", "decision", "approvalDate"]
    }
  },
  fields: {
    // Deal relationship
    deal: (0, import_fields15.relationship)({
      ref: "Deal.approvals",
      ui: {
        displayMode: "select"
      },
      label: "Deal"
    }),
    // Approver
    approver: (0, import_fields15.relationship)({
      ref: "User.dealApprovals",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Approver"
    }),
    // Approval Decision
    decision: (0, import_fields15.select)({
      type: "string",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
        { label: "Changes Requested", value: "changes-requested" }
      ],
      defaultValue: "pending",
      label: "Decision"
    }),
    // Feedback
    notes: (0, import_fields15.text)({
      ui: {
        displayMode: "textarea",
        description: "Approval notes or requested changes"
      },
      label: "Notes"
    }),
    // Timestamps
    approvalDate: (0, import_fields15.timestamp)({
      defaultValue: { kind: "now" },
      label: "Approval Date"
    })
  }
});

// features/keystone/models/TradeIn.ts
var import_core16 = require("@keystone-6/core");
var import_fields16 = require("@keystone-6/core/fields");
var TradeIn = (0, import_core16.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: () => true,
      // Allow public trade-in submissions from storefront
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["vin", "year", "make", "model", "condition", "offerAmount"]
    },
    labelField: "vin"
  },
  fields: {
    // Vehicle Identification
    vin: (0, import_fields16.text)({
      label: "VIN",
      ui: {
        description: "Vehicle Identification Number"
      }
    }),
    // Vehicle Details
    year: (0, import_fields16.text)({
      label: "Year"
    }),
    make: (0, import_fields16.text)({
      label: "Make",
      ui: {
        description: "Vehicle manufacturer (e.g., Toyota)"
      }
    }),
    model: (0, import_fields16.text)({
      label: "Model",
      ui: {
        description: "Vehicle model (e.g., Camry)"
      }
    }),
    trim: (0, import_fields16.text)({
      label: "Trim"
    }),
    mileage: (0, import_fields16.integer)({
      label: "Mileage",
      ui: {
        description: "Current odometer reading"
      }
    }),
    // Condition Assessment
    condition: (0, import_fields16.select)({
      type: "string",
      options: [
        { label: "Excellent", value: "excellent" },
        { label: "Good", value: "good" },
        { label: "Fair", value: "fair" },
        { label: "Poor", value: "poor" }
      ],
      label: "Overall Condition"
    }),
    exteriorCondition: (0, import_fields16.text)({
      ui: {
        displayMode: "textarea",
        description: "Notes on exterior condition, damage, paint, etc."
      },
      label: "Exterior Condition Notes"
    }),
    interiorCondition: (0, import_fields16.text)({
      ui: {
        displayMode: "textarea",
        description: "Notes on interior condition, wear, cleanliness, etc."
      },
      label: "Interior Condition Notes"
    }),
    mechanicalIssues: (0, import_fields16.text)({
      ui: {
        displayMode: "textarea",
        description: "Known mechanical issues or concerns"
      },
      label: "Mechanical Issues"
    }),
    // Valuation
    kbbValue: (0, import_fields16.float)({
      label: "KBB Value",
      ui: {
        description: "Kelley Blue Book estimated value"
      }
    }),
    offerAmount: (0, import_fields16.float)({
      label: "Offer Amount",
      ui: {
        description: "Actual trade-in offer from dealership"
      }
    }),
    // Images
    mainPhoto: (0, import_fields16.image)({
      storage: "my_images",
      label: "Main Photo"
    }),
    // Relationships
    deal: (0, import_fields16.relationship)({
      ref: "Deal.tradeInVehicle",
      ui: {
        displayMode: "select"
      },
      label: "Deal"
    }),
    appraisedBy: (0, import_fields16.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Appraised By"
    })
  }
});

// features/keystone/models/ServiceAppointment.ts
var import_core17 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");
var ServiceAppointment = (0, import_core17.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["customer", "appointmentDate", "serviceType", "status", "assignedTech"]
    }
  },
  fields: {
    // Customer and Vehicle
    customer: (0, import_fields17.relationship)({
      ref: "User.customerAppointments",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Customer"
    }),
    customerVehicleDescription: (0, import_fields17.text)({
      label: "Customer Vehicle",
      ui: {
        description: "Description of customer vehicle (Year Make Model)"
      }
    }),
    // Appointment Details
    appointmentDate: (0, import_fields17.timestamp)({
      label: "Appointment Date",
      validation: { isRequired: true }
    }),
    serviceType: (0, import_fields17.select)({
      type: "string",
      options: [
        { label: "Maintenance", value: "maintenance" },
        { label: "Repair", value: "repair" },
        { label: "Warranty", value: "warranty" },
        { label: "Recall", value: "recall" },
        { label: "Inspection", value: "inspection" },
        { label: "Diagnostic", value: "diagnostic" }
      ],
      label: "Service Type"
    }),
    description: (0, import_fields17.text)({
      ui: {
        displayMode: "textarea",
        description: "Customer complaint or service requested"
      },
      label: "Description"
    }),
    estimatedDuration: (0, import_fields17.integer)({
      label: "Estimated Duration (Minutes)",
      ui: {
        description: "Estimated time to complete service"
      }
    }),
    // Assignment
    assignedTech: (0, import_fields17.relationship)({
      ref: "User.techAppointments",
      ui: {
        displayMode: "select",
        labelField: "name"
      },
      label: "Assigned Technician"
    }),
    // Status
    status: (0, import_fields17.select)({
      type: "string",
      options: [
        { label: "Scheduled", value: "scheduled" },
        { label: "Checked In", value: "checked-in" },
        { label: "In Progress", value: "in-progress" },
        { label: "Waiting for Parts", value: "waiting-parts" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "scheduled",
      label: "Status"
    }),
    // Vehicle Info at Service
    mileageIn: (0, import_fields17.integer)({
      label: "Mileage In",
      ui: {
        description: "Odometer reading when vehicle checked in"
      }
    }),
    // Notes
    advisorNotes: (0, import_fields17.text)({
      ui: {
        displayMode: "textarea",
        description: "Service advisor notes"
      },
      label: "Advisor Notes"
    }),
    // Relationship to Service Order
    serviceOrder: (0, import_fields17.relationship)({
      ref: "ServiceOrder.appointment",
      ui: {
        displayMode: "cards",
        cardFields: ["status", "grandTotal"]
      },
      label: "Service Order"
    })
  }
});

// features/keystone/models/ServiceOrder.ts
var import_core18 = require("@keystone-6/core");
var import_fields18 = require("@keystone-6/core/fields");
var import_schema2 = require("@graphql-ts/schema");
var ServiceOrder = (0, import_core18.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["appointment", "status", "laborTotal", "partsTotal", "grandTotal"]
    }
  },
  fields: {
    // Link to Appointment
    appointment: (0, import_fields18.relationship)({
      ref: "ServiceAppointment.serviceOrder",
      ui: {
        displayMode: "select"
      },
      label: "Appointment"
    }),
    // Work Description
    diagnosis: (0, import_fields18.text)({
      ui: {
        displayMode: "textarea",
        description: "Initial diagnosis and findings"
      },
      label: "Diagnosis"
    }),
    workPerformed: (0, import_fields18.text)({
      ui: {
        displayMode: "textarea",
        description: "Detailed description of work completed"
      },
      label: "Work Performed"
    }),
    recommendations: (0, import_fields18.text)({
      ui: {
        displayMode: "textarea",
        description: "Recommended future service"
      },
      label: "Recommendations"
    }),
    // Line Items
    lineItems: (0, import_fields18.relationship)({
      ref: "RepairOrderLineItem.serviceOrder",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["itemType", "description", "quantity", "price"],
        inlineCreate: { fields: ["itemType", "description", "quantity", "unitPrice", "price"] },
        inlineEdit: { fields: ["itemType", "description", "quantity", "unitPrice", "price"] }
      },
      label: "Line Items"
    }),
    // Totals (can be calculated from line items or entered manually)
    laborTotal: (0, import_fields18.float)({
      label: "Labor Total",
      ui: {
        description: "Total labor charges"
      }
    }),
    partsTotal: (0, import_fields18.float)({
      label: "Parts Total",
      ui: {
        description: "Total parts charges"
      }
    }),
    subtotal: (0, import_fields18.virtual)({
      field: import_schema2.graphql.field({
        type: import_schema2.graphql.Float,
        async resolve(item) {
          const laborTotal = item.laborTotal || 0;
          const partsTotal = item.partsTotal || 0;
          return laborTotal + partsTotal;
        }
      }),
      ui: {
        listView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    tax: (0, import_fields18.float)({
      label: "Tax"
    }),
    grandTotal: (0, import_fields18.float)({
      label: "Grand Total",
      ui: {
        description: "Total amount including labor, parts, and tax"
      }
    }),
    // Status
    status: (0, import_fields18.select)({
      type: "string",
      options: [
        { label: "Estimate", value: "estimate" },
        { label: "Approved", value: "approved" },
        { label: "In Progress", value: "in-progress" },
        { label: "Completed", value: "completed" },
        { label: "Invoiced", value: "invoiced" },
        { label: "Paid", value: "paid" }
      ],
      defaultValue: "estimate",
      label: "Status"
    }),
    // Timestamps
    completedAt: (0, import_fields18.timestamp)({
      label: "Completed At",
      ui: {
        description: "When the service was completed"
      }
    })
  }
});

// features/keystone/models/RepairOrderLineItem.ts
var import_core19 = require("@keystone-6/core");
var import_fields19 = require("@keystone-6/core/fields");
var RepairOrderLineItem = (0, import_core19.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["serviceOrder", "itemType", "description", "quantity", "price"]
    },
    labelField: "description"
  },
  fields: {
    // Service Order relationship
    serviceOrder: (0, import_fields19.relationship)({
      ref: "ServiceOrder.lineItems",
      ui: {
        displayMode: "select"
      },
      label: "Service Order"
    }),
    // Item Details
    itemType: (0, import_fields19.select)({
      type: "string",
      options: [
        { label: "Labor", value: "labor" },
        { label: "Part", value: "part" }
      ],
      validation: { isRequired: true },
      label: "Item Type"
    }),
    description: (0, import_fields19.text)({
      validation: { isRequired: true },
      label: "Description",
      ui: {
        description: "Description of labor or part"
      }
    }),
    partNumber: (0, import_fields19.text)({
      label: "Part Number",
      ui: {
        description: "Part number if applicable"
      }
    }),
    // Quantity and Pricing
    quantity: (0, import_fields19.float)({
      validation: { isRequired: true },
      defaultValue: 1,
      label: "Quantity",
      ui: {
        description: "Quantity or hours"
      }
    }),
    unitPrice: (0, import_fields19.float)({
      validation: { isRequired: true },
      label: "Unit Price",
      ui: {
        description: "Price per unit or hourly rate"
      }
    }),
    price: (0, import_fields19.float)({
      validation: { isRequired: true },
      label: "Total Price",
      ui: {
        description: "Quantity \xD7 Unit Price"
      }
    }),
    // Cost tracking
    cost: (0, import_fields19.float)({
      label: "Cost",
      ui: {
        description: "Dealer cost for part (not shown to customer)"
      }
    })
  }
});

// features/keystone/models/ServicePackage.ts
var import_core20 = require("@keystone-6/core");
var import_fields20 = require("@keystone-6/core/fields");
var ServicePackage = (0, import_core20.list)({
  access: {
    operation: {
      query: () => true,
      // Allow public access to view service packages
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "price", "estimatedDuration"]
    },
    labelField: "name"
  },
  fields: {
    // Package Details
    name: (0, import_fields20.text)({
      validation: { isRequired: true },
      label: "Package Name",
      ui: {
        description: "e.g., Oil Change, Tire Rotation, Brake Service"
      }
    }),
    description: (0, import_fields20.text)({
      ui: {
        displayMode: "textarea"
      },
      label: "Description"
    }),
    // Pricing and Duration
    price: (0, import_fields20.float)({
      validation: { isRequired: true },
      label: "Price",
      ui: {
        description: "Package price"
      }
    }),
    estimatedDuration: (0, import_fields20.integer)({
      label: "Estimated Duration (Minutes)",
      ui: {
        description: "Expected time to complete"
      }
    }),
    // Included Services
    includedServices: (0, import_fields20.json)({
      defaultValue: [],
      label: "Included Services",
      ui: {
        description: "JSON array of services included [{service, description}]"
      }
    })
  }
});

// features/keystone/models/PartsInventory.ts
var import_core21 = require("@keystone-6/core");
var import_fields21 = require("@keystone-6/core/fields");
var PartsInventory = (0, import_core21.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["partNumber", "description", "quantity", "cost", "price"]
    },
    labelField: "partNumber"
  },
  fields: {
    // Part Details
    partNumber: (0, import_fields21.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      label: "Part Number"
    }),
    description: (0, import_fields21.text)({
      validation: { isRequired: true },
      label: "Description"
    }),
    // Inventory
    quantity: (0, import_fields21.integer)({
      validation: { isRequired: true },
      defaultValue: 0,
      label: "Quantity in Stock"
    }),
    minimumQuantity: (0, import_fields21.integer)({
      label: "Minimum Quantity",
      ui: {
        description: "Reorder threshold"
      }
    }),
    // Pricing
    cost: (0, import_fields21.float)({
      label: "Cost",
      ui: {
        description: "Dealer cost per unit"
      }
    }),
    price: (0, import_fields21.float)({
      validation: { isRequired: true },
      label: "Retail Price",
      ui: {
        description: "Sale price per unit"
      }
    }),
    // Supplier
    supplier: (0, import_fields21.text)({
      label: "Supplier",
      ui: {
        description: "Parts supplier name"
      }
    }),
    supplierPartNumber: (0, import_fields21.text)({
      label: "Supplier Part Number",
      ui: {
        description: "Supplier-specific part number"
      }
    })
  }
});

// features/keystone/models/index.ts
var models = {
  User,
  Role,
  Make,
  Model,
  Vehicle,
  VehicleImage,
  VehicleConditionReport,
  VehicleHistory,
  PriceHistory,
  Lead,
  CustomerInteraction,
  Task,
  TestDrive,
  Deal,
  DealApproval,
  TradeIn,
  ServiceAppointment,
  ServiceOrder,
  RepairOrderLineItem,
  ServicePackage,
  PartsInventory
};

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema3 = require("@graphql-tools/schema");

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/mutations/index.ts
var graphql3 = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema3.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql3`
      type Query {
        redirectToInit: Boolean
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default
      }
    }
  });
}

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
var transport = (0, import_nodemailer.createTransport)({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
function passwordResetEmail({ url }) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${resetToken}`
    })
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}

// features/keystone/index.ts
var databaseURL = process.env.DATABASE_URL || "file:./keystone.db";
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 360,
  // How long they stay signed in?
  secret: process.env.SESSION_SECRET || "this secret should only be used in testing"
};
var {
  S3_BUCKET_NAME: bucketName = "keystone-test",
  S3_REGION: region = "ap-southeast-2",
  S3_ACCESS_KEY_ID: accessKeyId = "keystone",
  S3_SECRET_ACCESS_KEY: secretAccessKey = "keystone",
  S3_ENDPOINT: endpoint = "https://sfo3.digitaloceanspaces.com"
} = process.env;
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      role: {
        create: {
          name: "Admin",
          canSeeOtherPeople: true,
          canEditOtherPeople: true,
          canManagePeople: true,
          canManageRoles: true,
          canAccessDashboard: true,
          canManageInventory: true,
          canViewInventory: true,
          canManageLeads: true,
          canViewAllLeads: true,
          canManageDeals: true,
          canApproveDeals: true,
          canManageService: true,
          canViewReports: true,
          canManageFinancing: true,
          canManageTradeIns: true
        }
      }
    }
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  sessionData: `
    name
    email
    role {
      id
      name
      canSeeOtherPeople
      canEditOtherPeople
      canManagePeople
      canManageRoles
      canAccessDashboard
      canManageInventory
      canViewInventory
      canManageLeads
      canViewAllLeads
      canManageDeals
      canApproveDeals
      canManageService
      canViewReports
      canManageFinancing
      canManageTradeIns
    }
  `
});
var keystone_default = withAuth(
  (0, import_core22.config)({
    db: {
      provider: "postgresql",
      url: databaseURL
    },
    lists: models,
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint,
        signed: { expiry: 5e3 },
        forcePathStyle: true
      }
    },
    ui: {
      isAccessAllowed: ({ session }) => permissions.canAccessDashboard({ session })
    },
    session: (0, import_session.statelessSessions)(sessionConfig),
    graphql: {
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
