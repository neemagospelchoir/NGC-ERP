export interface Trip {
  id: string;
  eventId: string;
  destination: string | null;
  vehicleRequirement: string | null;
  driverName: string | null;
  transportVendorId: string | null;
  accommodationVendorId: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  returnDepartureAt: string | null;
  returnArrivalAt: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTripInput {
  eventId: string;
  destination?: string | null;
  vehicleRequirement?: string | null;
  driverName?: string | null;
  transportVendorId?: string | null;
  accommodationVendorId?: string | null;
  departureAt?: string | null;
  arrivalAt?: string | null;
  returnDepartureAt?: string | null;
  returnArrivalAt?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  currency?: string;
  notes?: string | null;
}

export interface UpdateTripInput {
  destination?: string | null;
  vehicleRequirement?: string | null;
  driverName?: string | null;
  transportVendorId?: string | null;
  accommodationVendorId?: string | null;
  departureAt?: string | null;
  arrivalAt?: string | null;
  returnDepartureAt?: string | null;
  returnArrivalAt?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  currency?: string;
  notes?: string | null;
}
