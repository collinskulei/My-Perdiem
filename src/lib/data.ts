export type Employee = {
  id: string;
  name: string;
  phoneNumber: string;
  idNumber: string;
  employeeNumber: string;
  role: string;
  dutyStation: string;
  avatarUrl: string;
};

export type Hotel = {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
};

export type PerdiemRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  eventName: string;
  location: string;
  date: string;
  totalPerdiem: number;
  status: 'Approved' | 'Pending' | 'Rejected';
  checkInTimestamp?: number;
};

export const employees: Employee[] = [
  {
    id: '1',
    name: 'John Doe',
    phoneNumber: '555-0101',
    idNumber: '12345678',
    employeeNumber: 'EMP123',
    role: 'Facilitator',
    dutyStation: 'Nairobi',
    avatarUrl: 'https://picsum.photos/seed/10/100/100',
  },
  {
    id: '2',
    name: 'Jane Smith',
    phoneNumber: '555-0102',
    idNumber: '87654321',
    employeeNumber: 'EMP124',
    role: 'Sales Executive',
    dutyStation: 'Mombasa',
    avatarUrl: 'https://picsum.photos/seed/11/100/100',
  },
  {
    id: '3',
    name: 'Alex Johnson',
    phoneNumber: '555-0103',
    idNumber: '13579246',
    employeeNumber: 'EMP125',
    role: 'Developer',
    dutyStation: 'Kisumu',
    avatarUrl: 'https://picsum.photos/seed/12/100/100',
  },
  {
    id: '4',
    name: 'Emily White',
    phoneNumber: '555-0104',
    idNumber: '24681357',
    employeeNumber: 'EMP126',
    role: 'Project Manager',
    dutyStation: 'Nairobi',
    avatarUrl: 'https://picsum.photos/seed/13/100/100',
  },
  {
    id: '5',
    name: 'Michael Brown',
    phoneNumber: '555-0105',
    idNumber: '97531864',
    employeeNumber: 'EMP127',
    role: 'HR Officer',
    dutyStation: 'Nakuru',
    avatarUrl: 'https://picsum.photos/seed/14/100/100',
  },
];

export const perdiemRequests: PerdiemRequest[] = [
  {
    id: 'REQ001',
    employeeId: '2',
    employeeName: 'Jane Smith',
    eventName: 'Annual Sales Conference',
    location: 'Mombasa',
    date: '2024-08-15',
    totalPerdiem: 45000,
    status: 'Approved',
    checkInTimestamp: 1692086400000,
  },
  {
    id: 'REQ002',
    employeeId: '1',
    employeeName: 'John Doe',
    eventName: 'Leadership Training',
    location: 'Naivasha',
    date: '2024-08-20',
    totalPerdiem: 32000,
    status: 'Pending',
  },
  {
    id: 'REQ003',
    employeeId: '3',
    employeeName: 'Alex Johnson',
    eventName: 'Tech Summit 2024',
    location: 'Kisumu',
    date: '2024-09-01',
    totalPerdiem: 28500,
    status: 'Pending',
  },
  {
    id: 'REQ004',
    employeeId: '4',
    employeeName: 'Emily White',
    eventName: 'Project Kick-off',
    location: 'Nairobi',
    date: '2024-09-05',
    totalPerdiem: 15000,
    status: 'Approved',
    checkInTimestamp: 1693891200000,
  },
  {
    id: 'REQ005',
    employeeId: '2',
    employeeName: 'Jane Smith',
    eventName: 'Client Meeting',
    location: 'Nakuru',
    date: '2024-09-10',
    totalPerdiem: 18000,
    status: 'Rejected',
  },
];

export const hotels: Hotel[] = [
    { id: '1', name: 'Sarova Stanley', city: 'Nairobi', latitude: -1.2833, longitude: 36.8167 },
    { id: '2', name: 'Serena Beach Resort & Spa', city: 'Mombasa', latitude: -4.0435, longitude: 39.6682 },
    { id: '3', name: 'Acacia Premier Hotel', city: 'Kisumu', latitude: -0.0917, longitude: 34.7680 },
    { id: '4', name: 'Sarova Woodlands Hotel and Spa', city: 'Nakuru', latitude: -0.3031, longitude: 36.0801 },
    { id: '5', name: 'Enashipai Resort & Spa', city: 'Naivasha', latitude: -0.7212, longitude: 36.4304 },
];
