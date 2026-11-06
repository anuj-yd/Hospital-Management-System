import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash('Admin@12345', saltRounds);
  const staffPasswordHash = await bcrypt.hash('FrontDesk@12345', saltRounds);
  const doctorPasswordHash = await bcrypt.hash('Doctor@12345', saltRounds);

  // ─── 1. Users & Staff Accounts ──────────────────────────────
  console.log('👤 Seeding users...');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@hms.test' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000001',
      email: 'admin@hms.test',
      passwordHash: adminPasswordHash,
      fullName: 'System Administrator',
      role: 'ADMIN',
      isActive: true,
    },
  });

  const frontDesk1 = await prisma.user.upsert({
    where: { email: 'frontdesk1@hms.test' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000002',
      email: 'frontdesk1@hms.test',
      passwordHash: staffPasswordHash,
      fullName: 'Sarah Jenkins',
      role: 'FRONT_DESK',
      isActive: true,
    },
  });

  const frontDesk2 = await prisma.user.upsert({
    where: { email: 'frontdesk2@hms.test' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000003',
      email: 'frontdesk2@hms.test',
      passwordHash: staffPasswordHash,
      fullName: 'Michael Chang',
      role: 'FRONT_DESK',
      isActive: true,
    },
  });

  const clinicianUser1 = await prisma.user.upsert({
    where: { email: 'dr.sharma@hms.test' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000004',
      email: 'dr.sharma@hms.test',
      passwordHash: doctorPasswordHash,
      fullName: 'Dr. Rajesh Sharma',
      role: 'CLINICIAN',
      isActive: true,
    },
  });

  const clinicianUser2 = await prisma.user.upsert({
    where: { email: 'dr.patel@hms.test' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000005',
      email: 'dr.patel@hms.test',
      passwordHash: doctorPasswordHash,
      fullName: 'Dr. Priya Patel',
      role: 'CLINICIAN',
      isActive: true,
    },
  });

  const clinicianUser3 = await prisma.user.upsert({
    where: { email: 'dr.williams@hms.test' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000006',
      email: 'dr.williams@hms.test',
      passwordHash: doctorPasswordHash,
      fullName: 'Dr. David Williams',
      role: 'CLINICIAN',
      isActive: true,
    },
  });

  // ─── 2. Departments ─────────────────────────────────────────
  console.log('🏢 Seeding departments...');
  const cardiology = await prisma.department.upsert({
    where: { name: 'Cardiology' },
    update: {},
    create: {
      id: '20000000-0000-0000-0000-000000000001',
      name: 'Cardiology',
      description: 'Comprehensive adult and pediatric cardiac care, intervention, and diagnostic imaging.',
      isActive: true,
    },
  });

  const pediatrics = await prisma.department.upsert({
    where: { name: 'Pediatrics' },
    update: {},
    create: {
      id: '20000000-0000-0000-0000-000000000002',
      name: 'Pediatrics',
      description: 'Primary and specialized medical care for infants, children, and adolescents.',
      isActive: true,
    },
  });

  const orthopedics = await prisma.department.upsert({
    where: { name: 'Orthopedics' },
    update: {},
    create: {
      id: '20000000-0000-0000-0000-000000000003',
      name: 'Orthopedics',
      description: 'Musculoskeletal medicine, joint replacement, sports injury care, and trauma reconstruction.',
      isActive: true,
    },
  });

  // ─── 3. Doctors ─────────────────────────────────────────────
  console.log('🩺 Seeding doctors...');
  const doctor1 = await prisma.doctor.upsert({
    where: { licenseNumber: 'MED-CARD-1001' },
    update: {},
    create: {
      id: '30000000-0000-0000-0000-000000000001',
      userId: clinicianUser1.id,
      departmentId: cardiology.id,
      specialization: 'Interventional Cardiology',
      licenseNumber: 'MED-CARD-1001',
      slotDurationMin: 30,
      consultationFee: 1500.0,
      isActive: true,
    },
  });

  const doctor2 = await prisma.doctor.upsert({
    where: { licenseNumber: 'MED-PED-1002' },
    update: {},
    create: {
      id: '30000000-0000-0000-0000-000000000002',
      userId: clinicianUser2.id,
      departmentId: pediatrics.id,
      specialization: 'General Pediatrics & Neonatology',
      licenseNumber: 'MED-PED-1002',
      slotDurationMin: 20,
      consultationFee: 1200.0,
      isActive: true,
    },
  });

  const doctor3 = await prisma.doctor.upsert({
    where: { licenseNumber: 'MED-ORTH-1003' },
    update: {},
    create: {
      id: '30000000-0000-0000-0000-000000000003',
      userId: clinicianUser3.id,
      departmentId: orthopedics.id,
      specialization: 'Orthopedic Surgery & Sports Medicine',
      licenseNumber: 'MED-ORTH-1003',
      slotDurationMin: 30,
      consultationFee: 1800.0,
      isActive: true,
    },
  });

  // ─── 4. Doctor Schedules (Mon-Fri: 1 to 5) ──────────────────
  console.log('📅 Seeding doctor schedules (Monday through Friday)...');
  const doctors = [doctor1, doctor2, doctor3];
  for (const doc of doctors) {
    for (let day = 1; day <= 5; day++) {
      await prisma.doctorSchedule.upsert({
        where: {
          doctorId_dayOfWeek_startTime: {
            doctorId: doc.id,
            dayOfWeek: day,
            startTime: '09:00',
          },
        },
        update: {},
        create: {
          doctorId: doc.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '13:00',
          isActive: true,
        },
      });

      await prisma.doctorSchedule.upsert({
        where: {
          doctorId_dayOfWeek_startTime: {
            doctorId: doc.id,
            dayOfWeek: day,
            startTime: '14:00',
          },
        },
        update: {},
        create: {
          doctorId: doc.id,
          dayOfWeek: day,
          startTime: '14:00',
          endTime: '17:00',
          isActive: true,
        },
      });
    }
  }

  // ─── 5. 25 Synthetic Patients ───────────────────────────────
  console.log('🧑‍🤝‍🧑 Seeding 25 synthetic patients...');
  const patientData = [
    { firstName: 'Aarav', lastName: 'Kumar', gender: 'MALE', dob: '1988-04-12', phone: '+919811100001' },
    { firstName: 'Ananya', lastName: 'Sharma', gender: 'FEMALE', dob: '1992-08-23', phone: '+919811100002' },
    { firstName: 'Rohan', lastName: 'Mehta', gender: 'MALE', dob: '1975-11-05', phone: '+919811100003' },
    { firstName: 'Diya', lastName: 'Iyer', gender: 'FEMALE', dob: '1998-02-17', phone: '+919811100004' },
    { firstName: 'Kabir', lastName: 'Verma', gender: 'MALE', dob: '1984-07-29', phone: '+919811100005' },
    { firstName: 'Sneha', lastName: 'Reddy', gender: 'FEMALE', dob: '1990-10-14', phone: '+919811100006' },
    { firstName: 'Vikram', lastName: 'Chauhan', gender: 'MALE', dob: '1968-03-30', phone: '+919811100007' },
    { firstName: 'Pooja', lastName: 'Nair', gender: 'FEMALE', dob: '1995-12-08', phone: '+919811100008' },
    { firstName: 'Aditya', lastName: 'Joshi', gender: 'MALE', dob: '2001-05-19', phone: '+919811100009' },
    { firstName: 'Kavita', lastName: 'Deshmukh', gender: 'FEMALE', dob: '1982-09-02', phone: '+919811100010' },
    { firstName: 'Arjun', lastName: 'Gupta', gender: 'MALE', dob: '1979-06-11', phone: '+919811100011' },
    { firstName: 'Ritu', lastName: 'Malhotra', gender: 'FEMALE', dob: '1993-01-25', phone: '+919811100012' },
    { firstName: 'Sanjay', lastName: 'Bhatia', gender: 'MALE', dob: '1965-07-16', phone: '+919811100013' },
    { firstName: 'Meera', lastName: 'Sen', gender: 'FEMALE', dob: '1989-11-20', phone: '+919811100014' },
    { firstName: 'Nikhil', lastName: 'Saxena', gender: 'MALE', dob: '1996-04-03', phone: '+919811100015' },
    { firstName: 'Priya', lastName: 'Das', gender: 'FEMALE', dob: '1991-08-15', phone: '+919811100016' },
    { firstName: 'Harsh', lastName: 'Mishra', gender: 'MALE', dob: '1986-10-27', phone: '+919811100017' },
    { firstName: 'Isha', lastName: 'Kapoor', gender: 'FEMALE', dob: '2003-09-12', phone: '+919811100018' },
    { firstName: 'Gaurav', lastName: 'Pandey', gender: 'MALE', dob: '1973-12-01', phone: '+919811100019' },
    { firstName: 'Deepika', lastName: 'Roy', gender: 'FEMALE', dob: '1987-05-09', phone: '+919811100020' },
    { firstName: 'Varun', lastName: 'Sethi', gender: 'MALE', dob: '1994-03-18', phone: '+919811100021' },
    { firstName: 'Neha', lastName: 'Bansal', gender: 'FEMALE', dob: '1997-07-07', phone: '+919811100022' },
    { firstName: 'Rahul', lastName: 'Aggarwal', gender: 'MALE', dob: '1980-02-14', phone: '+919811100023' },
    { firstName: 'Simran', lastName: 'Kaur', gender: 'FEMALE', dob: '1999-11-29', phone: '+919811100024' },
    { firstName: 'Abhishek', lastName: 'Rao', gender: 'MALE', dob: '1985-06-04', phone: '+919811100025' },
  ];

  const seededPatients = [];
  for (let i = 0; i < patientData.length; i++) {
    const p = patientData[i];
    const indexStr = String(i + 1).padStart(4, '0');
    const mrn = `MRN-2026-${indexStr}`;

    const patient = await prisma.patient.upsert({
      where: { mrn },
      update: {},
      create: {
        id: `40000000-0000-0000-0000-00000000${indexStr}`,
        mrn,
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: new Date(p.dob),
        gender: p.gender,
        phone: p.phone,
        email: `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase()}@example.test`,
        address: `${100 + i}, MG Road, Sector ${i + 1}, Bengaluru, KA 560001`,
        emergencyContactName: `Emergency Contact for ${p.firstName}`,
        emergencyContactPhone: '+919822200000',
        isActive: true,
      },
    });
    seededPatients.push(patient);
  }

  // ─── 6. Appointments (Various Statuses) ─────────────────────
  console.log('🩺 Seeding sample appointments across statuses...');
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 30, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setMinutes(tomorrowEnd.getMinutes() + 30);

  const todayCheckedIn = new Date(now);
  todayCheckedIn.setHours(10, 0, 0, 0);
  const todayCheckedInEnd = new Date(todayCheckedIn);
  todayCheckedInEnd.setMinutes(todayCheckedInEnd.getMinutes() + 30);

  const yesterdayCompleted = new Date(now);
  yesterdayCompleted.setDate(yesterdayCompleted.getDate() - 1);
  yesterdayCompleted.setHours(11, 0, 0, 0);
  const yesterdayCompletedEnd = new Date(yesterdayCompleted);
  yesterdayCompletedEnd.setMinutes(yesterdayCompletedEnd.getMinutes() + 30);

  const yesterdayCancelled = new Date(now);
  yesterdayCancelled.setDate(yesterdayCancelled.getDate() - 1);
  yesterdayCancelled.setHours(14, 0, 0, 0);
  const yesterdayCancelledEnd = new Date(yesterdayCancelled);
  yesterdayCancelledEnd.setMinutes(yesterdayCancelledEnd.getMinutes() + 30);

  const pastNoShow = new Date(now);
  pastNoShow.setDate(pastNoShow.getDate() - 2);
  pastNoShow.setHours(15, 0, 0, 0);
  const pastNoShowEnd = new Date(pastNoShow);
  pastNoShowEnd.setMinutes(pastNoShowEnd.getMinutes() + 30);

  // SCHEDULED Appointment
  await prisma.appointment.upsert({
    where: { id: '50000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '50000000-0000-0000-0000-000000000001',
      patientId: seededPatients[0].id,
      doctorId: doctor1.id,
      startTime: tomorrow,
      endTime: tomorrowEnd,
      status: 'SCHEDULED',
      reason: 'Routine annual cardiac evaluation and follow-up.',
      createdById: frontDesk1.id,
    },
  });

  // CHECKED_IN Appointment
  await prisma.appointment.upsert({
    where: { id: '50000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '50000000-0000-0000-0000-000000000002',
      patientId: seededPatients[1].id,
      doctorId: doctor2.id,
      startTime: todayCheckedIn,
      endTime: todayCheckedInEnd,
      status: 'CHECKED_IN',
      reason: 'Child immunization booster and physical growth tracking.',
      createdById: frontDesk2.id,
    },
  });

  // COMPLETED Appointment (will link to visit)
  const completedAppt = await prisma.appointment.upsert({
    where: { id: '50000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '50000000-0000-0000-0000-000000000003',
      patientId: seededPatients[2].id,
      doctorId: doctor1.id,
      startTime: yesterdayCompleted,
      endTime: yesterdayCompletedEnd,
      status: 'COMPLETED',
      reason: 'Episodes of palpitations and exertion fatigue.',
      createdById: frontDesk1.id,
    },
  });

  // CANCELLED Appointment
  await prisma.appointment.upsert({
    where: { id: '50000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '50000000-0000-0000-0000-000000000004',
      patientId: seededPatients[3].id,
      doctorId: doctor3.id,
      startTime: yesterdayCancelled,
      endTime: yesterdayCancelledEnd,
      status: 'CANCELLED',
      reason: 'Knee stiffness and joint swelling.',
      cancelReason: 'Patient called to reschedule due to emergency travel.',
      createdById: frontDesk2.id,
    },
  });

  // NO_SHOW Appointment
  await prisma.appointment.upsert({
    where: { id: '50000000-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '50000000-0000-0000-0000-000000000005',
      patientId: seededPatients[4].id,
      doctorId: doctor3.id,
      startTime: pastNoShow,
      endTime: pastNoShowEnd,
      status: 'NO_SHOW',
      reason: 'Post-op fracture follow-up review.',
      createdById: frontDesk1.id,
    },
  });

  // ─── 7. Completed Visit & Prescription ──────────────────────
  console.log('🩺 Seeding completed clinical encounter & prescription...');
  const completedVisit = await prisma.visit.upsert({
    where: { appointmentId: completedAppt.id },
    update: {},
    create: {
      id: '60000000-0000-0000-0000-000000000001',
      appointmentId: completedAppt.id,
      patientId: seededPatients[2].id,
      doctorId: doctor1.id,
      status: 'CLOSED',
      checkInAt: yesterdayCompleted,
      closedAt: yesterdayCompletedEnd,
      chiefComplaint: 'Intermittent chest flutter and mild fatigue on stairs.',
      clinicalNotes:
        'Vitals stable. BP 122/78 mmHg, Pulse 72 bpm regular. ECG confirms normal sinus rhythm with occasional PACs. Advised moderation in caffeine and 30-minute daily brisk walking.',
    },
  });

  await prisma.prescription.upsert({
    where: { id: '70000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '70000000-0000-0000-0000-000000000001',
      visitId: completedVisit.id,
      medication: 'Metoprolol Tartrate',
      dosage: '25mg',
      frequency: 'Once daily (morning)',
      durationDays: 30,
      instructions: 'Take with or immediately following a meal. Do not discontinue abruptly.',
      prescribedById: clinicianUser1.id,
    },
  });

  // ─── 8. Invoice with Items & Settled Payment ────────────────
  console.log('💳 Seeding sample invoice, line item, and payment...');
  const invoice = await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-2026-0001' },
    update: {},
    create: {
      id: '80000000-0000-0000-0000-000000000001',
      invoiceNumber: 'INV-2026-0001',
      patientId: seededPatients[2].id,
      visitId: completedVisit.id,
      status: 'PAID',
      subtotal: 1500.0,
      taxAmount: 0.0,
      discountAmount: 0.0,
      totalAmount: 1500.0,
      amountPaid: 1500.0,
      issuedAt: yesterdayCompleted,
      dueDate: yesterdayCompleted,
      createdById: frontDesk1.id,
    },
  });

  await prisma.invoiceItem.upsert({
    where: { id: '90000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '90000000-0000-0000-0000-000000000001',
      invoiceId: invoice.id,
      description: 'Specialist Consultation - Cardiology (Dr. Rajesh Sharma)',
      quantity: 1,
      unitPrice: 1500.0,
      lineTotal: 1500.0,
    },
  });

  await prisma.payment.upsert({
    where: { idempotencyKey: 'seed-payment-inv-2026-0001' },
    update: {},
    create: {
      id: 'a0000000-0000-0000-0000-000000000001',
      invoiceId: invoice.id,
      amount: 1500.0,
      method: 'UPI',
      status: 'SUCCEEDED',
      gatewayReference: 'UPI-REF-20261106-99214',
      idempotencyKey: 'seed-payment-inv-2026-0001',
      createdById: frontDesk1.id,
      createdAt: yesterdayCompleted,
    },
  });

  console.log('\n============================================================');
  console.log('✅ DATABASE SEED COMPLETED SUCCESSFULLY');
  console.log('============================================================\n');
  console.log('🔐 DEMO CREDENTIALS (Use for testing API & Portal):');
  console.log('------------------------------------------------------------');
  console.log('Role       | Email                   | Password');
  console.log('-----------+-------------------------+----------------------');
  console.log('ADMIN      | admin@hms.test          | Admin@12345');
  console.log('FRONT_DESK | frontdesk1@hms.test      | FrontDesk@12345');
  console.log('FRONT_DESK | frontdesk2@hms.test      | FrontDesk@12345');
  console.log('CLINICIAN  | dr.sharma@hms.test       | Doctor@12345 (Cardiology)');
  console.log('CLINICIAN  | dr.patel@hms.test        | Doctor@12345 (Pediatrics)');
  console.log('CLINICIAN  | dr.williams@hms.test     | Doctor@12345 (Orthopedics)');
  console.log('------------------------------------------------------------\n');
}

main()
  .catch((e) => {
    console.error('❌ Error executing database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

