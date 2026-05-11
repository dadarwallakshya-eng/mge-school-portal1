// api.js — MGE School Portal — Single API handler for ALL routes
// Routes:  /api/login  /api/me  /api/seed  /api/students  /api/fees
//          /api/teachers  /api/salaries  /api/accounts  /api/transactions
//          /api/transport  /api/hostel  /api/overview

const { neon }   = require('@neondatabase/serverless');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');

const sql = neon(process.env.DATABASE_URL);

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET missing');
}

const SECRET = process.env.JWT_SECRET;

// ── Auth helpers ─────────────────────────────────────────────────
function signToken(p)  { return jwt.sign(p, SECRET, { expiresIn: '10h' }); }
function verifyToken(t){ return jwt.verify(t, SECRET); }
function getUser(req)  {
  const h = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!h) return null;
  try { return verifyToken(h); } catch { return null; }
}
function requireAuth(req, res) {
  const u = getUser(req);
  if (!u) { res.status(401).json({ error: 'Unauthorized — please login' }); return null; }
  return u;
}
function cors(res) {
  res.setHeader(
  'Access-Control-Allow-Origin',
  'https://mge-school-portal1.vercel.app'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}
function isDir(user) { return (user?.access||[]).includes('director'); }
function can(user, p){ return isDir(user) || (user?.access||[]).includes(p); }
async function parseBody(req) {
  if (req.body) return req.body;

  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', chunk => {
      data += chunk;
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (err) {
        reject(err);
      }
    });
  });
}

// ── Main handler ─────────────────────────────────────────────────
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extract route from URL  e.g. /api/students → 'students'
  const route = (req.url || '').replace(/^\/api\//, '').split('?')[0].split('/')[0];

  try {
    switch (route) {

      // ════════════ LOGIN ════════════
      case 'login': {
        if (req.method !== 'POST') return res.status(405).end();
        const body = await parseBody(req);
        const { username, password } = body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        const rows = await sql`SELECT * FROM users WHERE username=${username.trim().toLowerCase()} LIMIT 1`;
        const user = rows[0];
        if (!user || !bcrypt.compareSync(password, user.password))
          return res.status(401).json({ error: 'Invalid username or password' });
        const token = signToken({ id:user.id, name:user.name, role:user.role, username:user.username, access:user.access });
        return res.json({ token, user: { id:user.id, name:user.name, role:user.role, username:user.username, access:user.access } });
      }

      // ════════════ ME ════════════
      case 'me': {
        const user = requireAuth(req, res); if (!user) return;
        return res.json({ user });
      }

      // ════════════ SEED ════════════
      /*
case 'seed': {
  return res.status(403).json({
    error: 'Seed route disabled in production'
  });
}
*/

      // ════════════ STUDENTS ════════════
      case 'students': {
        const user = requireAuth(req, res); if (!user) return;
        const { id, class:cls, search } = req.query;

let unit = req.query.unit;

// 🔐 FORCE ROLE-BASED UNIT ACCESS
if (user.role === 'hindi_principal') {
  unit = 'hindi';
}

if (user.role === 'english_principal') {
  unit = 'english';
}

if (user.role === 'college_principal') {
  unit = 'college';
}

        if (req.method === 'GET') {
          if (id) {
            const r = await sql`SELECT * FROM students WHERE admission_id=${id}`;
            return res.json(r[0]||null);
          }
          let rows;
          if (unit && cls && search) {
            rows = await sql`SELECT * FROM students WHERE unit=${unit} AND class=${cls} AND (name ILIKE ${'%'+search+'%'} OR roll_no ILIKE ${'%'+search+'%'}) ORDER BY name`;
          } else if (unit && cls) {
            rows = await sql`SELECT * FROM students WHERE unit=${unit} AND class=${cls} ORDER BY name`;
          } else if (unit && search) {
            rows = await sql`SELECT * FROM students WHERE unit=${unit} AND (name ILIKE ${'%'+search+'%'} OR roll_no ILIKE ${'%'+search+'%'}) ORDER BY name`;
          } else if (unit) {
            rows = await sql`SELECT * FROM students WHERE unit=${unit} ORDER BY class, name`;
          } else {
            rows = await sql`SELECT * FROM students ORDER BY unit, class, name`;
          }
          return res.json(rows);
        }

        if (req.method === 'POST') {
          const b = req.body||{};
          if (!b.unit||!b.name) return res.status(400).json({ error:'unit and name required' });

          // Auto-generate admission ID
          const PREFIX = { hindi:'NMSSS', english:'MES', college:'MGC' };
          const prefix = PREFIX[b.unit] || 'MGE';
          // Count existing students for this unit to get next number
          const countRow = await sql`SELECT COUNT(*) as c FROM students WHERE unit=${b.unit}`;
          const nextNum  = (+countRow[0].c) + 1;
          const admissionId = prefix + String(nextNum).padStart(3, '0');

          const r = await sql`INSERT INTO students (unit,name,name_hindi,roll_no,admission_id,class,section,gender,dob,father_name,mother_name,phone,father_phone,address,aadhar,category,admission_date,photo_url) VALUES (${b.unit},${b.name},${b.nameHindi||null},${b.rollNo||null},${admissionId},${b.class||null},${b.section||null},${b.gender||null},${b.dob||null},${b.fatherName||null},${b.motherName||null},${b.phone||null},${b.fatherPhone||null},${b.address||null},${b.aadhar||null},${b.category||'General'},${b.admissionDate||null},${b.photoUrl||null}) RETURNING *`;
          return res.status(201).json(r[0]);
        }

        if (req.method === 'PATCH') {
          if (!id) return res.status(400).json({ error:'id required' });
          const cur = (await sql`SELECT * FROM students WHERE admission_id=${id}`)[0];
          if (!cur) return res.status(404).json({ error:'Not found' });
          const b = req.body||{};
          const r = await sql`UPDATE students SET name=${b.name??cur.name},name_hindi=${b.nameHindi??cur.name_hindi},roll_no=${b.rollNo??cur.roll_no},class=${b.class??cur.class},section=${b.section??cur.section},gender=${b.gender??cur.gender},dob=${b.dob??cur.dob},father_name=${b.fatherName??cur.father_name},mother_name=${b.motherName??cur.mother_name},phone=${b.phone??cur.phone},father_phone=${b.fatherPhone??cur.father_phone},address=${b.address??cur.address},aadhar=${b.aadhar??cur.aadhar},category=${b.category??cur.category},photo_url=${b.photoUrl??cur.photo_url},updated_at=NOW() WHERE admission_id=${id} RETURNING *`;
          return res.json(r[0]);
        }

        if (req.method === 'DELETE') {
          if (!id) return res.status(400).json({ error:'id required' });
          await sql`DELETE FROM students WHERE admission_id=${id}`;
          return res.json({ success:true });
        }
        break;
      }

      // ════════════ FEES ════════════
      case 'fees': {
        const user = requireAuth(req, res); if (!user) return;
        const { id, unit, studentId } = req.query;

        if (req.method === 'GET') {
          if (studentId) {
            const r = await sql`SELECT fp.* FROM fee_payments fp WHERE fp.student_id=${studentId} ORDER BY fp.payment_date DESC`;
            return res.json(r);
          }
          if (unit) {
            const r = await sql`SELECT fp.* FROM fee_payments fp WHERE fp.unit=${unit} ORDER BY fp.payment_date DESC LIMIT 300`;
            return res.json(r);
          }
          const r = await sql`SELECT fp.* FROM fee_payments fp ORDER BY fp.payment_date DESC LIMIT 500`;
          return res.json(r);
        }

        if (req.method === 'POST') {
          const { studentId:sid, unit:u, amount, mode, receiptNo, paymentDate, feeType, notes } = req.body||{};
          if (!sid||!amount||!u) return res.status(400).json({ error:'studentId, unit, amount required' });
          const r = await sql`INSERT INTO fee_payments (student_id,unit,amount,mode,receipt_no,payment_date,fee_type,notes) VALUES (${sid},${u},${+amount},${mode||'Cash'},${receiptNo||null},${paymentDate||new Date().toISOString().slice(0,10)},${feeType||'Tuition'},${notes||null}) RETURNING *`;
          // AUTO UPDATE BALANCE
          if (+amount > 0 && u) {
            await sql`UPDATE accounts SET balance = balance + ${+amount}, updated_at = NOW() WHERE unit = ${u} AND account_type = 'Cash'`.catch(()=>{});
          }
          return res.status(201).json(r[0]);
        }

        if (req.method === 'DELETE') {
          if (!id) return res.status(400).json({ error:'id required' });
          // Reverse balance on delete
          const fee = await sql`SELECT * FROM fee_payments WHERE id=${id} LIMIT 1`.catch(()=>[]);
          if (fee.length && +fee[0].amount > 0 && fee[0].unit) {
            await sql`UPDATE accounts SET balance = balance - ${+fee[0].amount}, updated_at = NOW() WHERE unit = ${fee[0].unit} AND account_type = 'Cash'`.catch(()=>{});
          }
          await sql`DELETE FROM fee_payments WHERE id=${id}`;
          return res.json({ success:true });
        }
        break;
      }

      // ════════════ TEACHERS ════════════
      case 'teachers': {
        const user = requireAuth(req, res); if (!user) return;
        const { id, unit } = req.query;

        if (req.method === 'GET') {
          if (id) { const r = await sql`SELECT * FROM teachers WHERE id=${id}`; return res.json(r[0]||null); }
          const r = unit ? await sql`SELECT * FROM teachers WHERE unit=${unit} ORDER BY name` : await sql`SELECT * FROM teachers ORDER BY unit,name`;
          return res.json(r);
        }

        if (req.method === 'POST') {
          const b = req.body||{};
          if (!b.unit||!b.name) return res.status(400).json({ error:'unit and name required' });
          const r = await sql`INSERT INTO teachers (unit,name,designation,department,subject,qualification,phone,email,address,dob,joining_date,salary,bank_account,aadhar,photo_url,status) VALUES (${b.unit},${b.name},${b.designation||null},${b.department||null},${b.subject||null},${b.qualification||null},${b.phone||null},${b.email||null},${b.address||null},${b.dob||null},${b.joiningDate||null},${+(b.salary||0)},${b.bankAccount||null},${b.aadhar||null},${b.photoUrl||null},${b.status||'Active'}) RETURNING *`;
          return res.status(201).json(r[0]);
        }

        if (req.method === 'PATCH') {
          if (!id) return res.status(400).json({ error:'id required' });
          const cur = (await sql`SELECT * FROM teachers WHERE id=${id}`)[0];
          if (!cur) return res.status(404).json({ error:'Not found' });
          const b = req.body||{};
          const r = await sql`UPDATE teachers SET name=${b.name??cur.name},designation=${b.designation??cur.designation},department=${b.department??cur.department},subject=${b.subject??cur.subject},qualification=${b.qualification??cur.qualification},phone=${b.phone??cur.phone},email=${b.email??cur.email},address=${b.address??cur.address},salary=${b.salary!==undefined?+b.salary:+cur.salary},bank_account=${b.bankAccount??cur.bank_account},aadhar=${b.aadhar??cur.aadhar},photo_url=${b.photoUrl??cur.photo_url},status=${b.status??cur.status},updated_at=NOW() WHERE id=${id} RETURNING *`;
          return res.json(r[0]);
        }

        if (req.method === 'DELETE') {
          if (!id) return res.status(400).json({ error:'id required' });
          await sql`DELETE FROM teachers WHERE id=${id}`;
          return res.json({ success:true });
        }
        break;
      }

      // ════════════ SALARIES ════════════
      case 'salaries': {
        const user = requireAuth(req, res); if (!user) return;
        const { id, unit, month, year, teacherId } = req.query;

        if (req.method === 'GET') {
          if (teacherId) {
            const r = await sql`SELECT * FROM salary_payments WHERE teacher_id=${teacherId} ORDER BY year DESC, month DESC`;
            return res.json(r);
          }
          if (unit && year) {
            const r = await sql`SELECT sp.*, t.name as teacher_name, t.designation, t.salary as monthly_salary FROM salary_payments sp JOIN teachers t ON sp.teacher_id=t.id WHERE sp.unit=${unit} AND sp.year=${+year} ORDER BY sp.month, t.name`;
            return res.json(r);
          }
          return res.json([]);
        }

        if (req.method === 'POST') {
          const { teacherId:tid, unit:u, month:m, year:y, amount, mode, paidDate, remarks } = req.body||{};
          if (!tid||!u||!m||!y) return res.status(400).json({ error:'teacherId, unit, month, year required' });
          const existing = await sql`SELECT id FROM salary_payments WHERE teacher_id=${tid} AND month=${m} AND year=${+y}`;
          if (existing.length>0) return res.status(409).json({ error:'Already recorded for this month' });
          const r = await sql`INSERT INTO salary_payments (teacher_id,unit,month,year,amount,mode,paid_date,remarks) VALUES (${tid},${u},${m},${+y},${+amount},${mode||'Bank Transfer'},${paidDate||new Date().toISOString().slice(0,10)},${remarks||null}) RETURNING *`;
          // AUTO DEDUCT SALARY FROM BALANCE
          if (+amount > 0 && u) {
            await sql`UPDATE accounts SET balance = GREATEST(0, balance - ${+amount}), updated_at = NOW() WHERE unit = ${u} AND account_type = 'Cash'`.catch(()=>{});
          }
          return res.status(201).json(r[0]);
        }

        if (req.method === 'DELETE') {
          if (!id) return res.status(400).json({ error:'id required' });
          // Restore balance on salary delete
          const sal = await sql`SELECT * FROM salary_payments WHERE id=${id} LIMIT 1`.catch(()=>[]);
          if (sal.length && +sal[0].amount > 0 && sal[0].unit) {
            await sql`UPDATE accounts SET balance = balance + ${+sal[0].amount}, updated_at = NOW() WHERE unit = ${sal[0].unit} AND account_type = 'Cash'`.catch(()=>{});
          }
          await sql`DELETE FROM salary_payments WHERE id=${id}`;
          return res.json({ success:true });
        }
        break;
      }

      // ════════════ ACCOUNTS ════════════
      case 'accounts': {
        const user = requireAuth(req, res); if (!user) return;
        const { id, unit, type } = req.query;

        if (req.method === 'GET') {
          if (type === 'summary') {
            const accounts = await sql`SELECT * FROM accounts ORDER BY unit, account_type`;
            const income   = await sql`SELECT unit, SUM(amount) as total FROM income GROUP BY unit`;
            const expenses = await sql`SELECT unit, SUM(amount) as total FROM expenses GROUP BY unit`;
            const fees     = await sql`SELECT unit, SUM(amount) as total FROM fee_payments GROUP BY unit`;
            return res.json({ accounts, income, expenses, fees });
          }
          if (unit) {
            const accounts = await sql`SELECT * FROM accounts WHERE unit=${unit} ORDER BY account_type`;
            const income   = await sql`SELECT * FROM income WHERE unit=${unit} ORDER BY date DESC LIMIT 100`;
            const expenses = await sql`SELECT * FROM expenses WHERE unit=${unit} ORDER BY date DESC LIMIT 100`;
            const fees     = await sql`SELECT fp.* FROM fee_payments fp WHERE fp.unit=${unit} ORDER BY fp.payment_date DESC LIMIT 200`;
            return res.json({ accounts, income, expenses, fees });
          }
          return res.json(await sql`SELECT * FROM accounts ORDER BY unit, account_type`);
        }

        if (req.method === 'PATCH') {
          if (!id) return res.status(400).json({ error:'id required' });
          const { balance, accountName } = req.body||{};
          const r = await sql`UPDATE accounts SET balance=${+balance}, account_name=${accountName||null}, updated_at=NOW() WHERE id=${id} RETURNING *`;
          return res.json(r[0]);
        }

        if (req.method === 'POST') {
          const { unit:u, accountType, accountName, balance } = req.body||{};
          if (!u||!accountType) return res.status(400).json({ error:'unit and accountType required' });
          const r = await sql`INSERT INTO accounts (unit,account_type,account_name,balance) VALUES (${u},${accountType},${accountName||null},${+(balance||0)}) RETURNING *`;
          return res.status(201).json(r[0]);
        }
        break;
      }

      // ════════════ TRANSACTIONS (income/expense) ════════════
      case 'transactions': {
        const user = requireAuth(req, res); if (!user) return;
        const { txtype, unit, id } = req.query;
        const isIncome = txtype === 'income';

        if (req.method === 'GET') {
          const r = unit
            ? isIncome ? await sql`SELECT * FROM income WHERE unit=${unit} ORDER BY date DESC LIMIT 200`
                       : await sql`SELECT * FROM expenses WHERE unit=${unit} ORDER BY date DESC LIMIT 200`
            : isIncome ? await sql`SELECT * FROM income ORDER BY date DESC LIMIT 200`
                       : await sql`SELECT * FROM expenses ORDER BY date DESC LIMIT 200`;
          return res.json(r);
        }

        if (req.method === 'POST') {
          const b = req.body||{};
          if (!b.unit||!b.amount) return res.status(400).json({ error:'unit and amount required' });
          let r;
          if (isIncome) {
            r = await sql`INSERT INTO income (unit,source,description,amount,date,mode) VALUES (${b.unit},${b.source||'Other'},${b.description||null},${+b.amount},${b.date||null},${b.mode||'Cash'}) RETURNING *`;
          } else {
            r = await sql`INSERT INTO expenses (unit,category,description,amount,date,mode,bill_no) VALUES (${b.unit},${b.category||'Other'},${b.description||null},${+b.amount},${b.date||null},${b.mode||'Cash'},${b.billNo||null}) RETURNING *`;
          }
          return res.status(201).json(r[0]);
        }

        if (req.method === 'DELETE') {
          if (!id) return res.status(400).json({ error:'id required' });
          if (isIncome) await sql`DELETE FROM income WHERE id=${id}`;
          else          await sql`DELETE FROM expenses WHERE id=${id}`;
          return res.json({ success:true });
        }
        break;
      }

      // ════════════ TRANSPORT ════════════
      case 'transport': {
        const user = requireAuth(req, res); if (!user) return;
        const { section, id } = req.query;

        if (!section || section === 'buses') {
          if (req.method === 'GET') return res.json(await sql`SELECT * FROM buses ORDER BY bus_no`);
          if (req.method === 'POST') {
            const { busNo,route,driver,driverPhone,capacity,students,status } = req.body||{};
            if (!busNo) return res.status(400).json({ error:'busNo required' });
            const r = await sql`INSERT INTO buses (bus_no,route,driver,driver_phone,capacity,students,status) VALUES (${busNo},${route||null},${driver||null},${driverPhone||null},${+(capacity||0)},${+(students||0)},${status||'Active'}) RETURNING *`;
            return res.status(201).json(r[0]);
          }
          if (req.method === 'PATCH') {
            if (!id) return res.status(400).json({ error:'id required' });
            const cur = (await sql`SELECT * FROM buses WHERE id=${id}`)[0];
            if (!cur) return res.status(404).json({ error:'Not found' });
            const b = req.body||{};
            const r = await sql`UPDATE buses SET bus_no=${b.busNo??cur.bus_no},route=${b.route??cur.route},driver=${b.driver??cur.driver},driver_phone=${b.driverPhone??cur.driver_phone},capacity=${b.capacity!==undefined?+b.capacity:+cur.capacity},students=${b.students!==undefined?+b.students:+cur.students},status=${b.status??cur.status} WHERE id=${id} RETURNING *`;
            return res.json(r[0]);
          }
          if (req.method === 'DELETE') {
            if (!id) return res.status(400).json({ error:'id required' });
            await sql`DELETE FROM buses WHERE id=${id}`;
            return res.json({ success:true });
          }
        }

        if (section === 'expenses') {
          if (req.method === 'GET') return res.json(await sql`SELECT * FROM transport_expenses ORDER BY created_at DESC`);
          if (req.method === 'POST') {
            const { busNo,type,description,amount,date } = req.body||{};
            if (!amount) return res.status(400).json({ error:'amount required' });
            const r = await sql`INSERT INTO transport_expenses (bus_no,type,description,amount,date) VALUES (${busNo||null},${type||'Other'},${description||null},${+amount},${date||null}) RETURNING *`;
            return res.status(201).json(r[0]);
          }
          if (req.method === 'DELETE') {
            if (!id) return res.status(400).json({ error:'id required' });
            await sql`DELETE FROM transport_expenses WHERE id=${id}`;
            return res.json({ success:true });
          }
        }
        break;
      }

      // ════════════ HOSTEL ════════════
      case 'hostel': {
        const user = requireAuth(req, res); if (!user) return;
        const { section, id, month } = req.query;

        if (section === 'rooms') {
          if (req.method === 'GET') return res.json(await sql`SELECT * FROM hostel_rooms ORDER BY room_no`);
          if (req.method === 'POST') {
            const { roomNo,floor,capacity,feePerStudent,type } = req.body||{};
            if (!roomNo) return res.status(400).json({ error:'roomNo required' });
            const r = await sql`INSERT INTO hostel_rooms (room_no,floor,capacity,occupied,fee_per_student,type,status) VALUES (${roomNo},${floor||'Ground'},${+(capacity||4)},0,${+(feePerStudent||3000)},${type||'Standard'},'Available') RETURNING *`;
            return res.status(201).json(r[0]);
          }
          if (req.method === 'DELETE') {
            await sql`DELETE FROM hostel_rooms WHERE id=${id}`;
            return res.json({ success:true });
          }
        }

        if (section === 'students') {
          if (req.method === 'GET') return res.json(await sql`SELECT * FROM hostel_students ORDER BY name`);
          if (req.method === 'POST') {
            const { name,roomNo,unit,class:cls,phone,parentPhone,fatherName,monthlyFee } = req.body||{};
            if (!name) return res.status(400).json({ error:'name required' });
            const r = await sql`INSERT INTO hostel_students (name,room_no,unit,class,phone,parent_phone,father_name,monthly_fee) VALUES (${name},${roomNo||null},${unit||null},${cls||null},${phone||null},${parentPhone||null},${fatherName||null},${+(monthlyFee||3000)}) RETURNING *`;
            if (roomNo) {
              const rm = (await sql`SELECT * FROM hostel_rooms WHERE room_no=${roomNo}`)[0];
              if (rm) { const o=+rm.occupied+1; await sql`UPDATE hostel_rooms SET occupied=${o},status=${o>=+rm.capacity?'Full':'Available'} WHERE room_no=${roomNo}`; }
            }
            return res.status(201).json(r[0]);
          }
          if (req.method === 'DELETE') {
            const s = (await sql`SELECT * FROM hostel_students WHERE id=${id}`)[0];
            if (s?.room_no) {
              const rm = (await sql`SELECT * FROM hostel_rooms WHERE room_no=${s.room_no}`)[0];
              if (rm) { const o=Math.max(0,+rm.occupied-1); await sql`UPDATE hostel_rooms SET occupied=${o},status=${o>=+rm.capacity?'Full':'Available'} WHERE room_no=${s.room_no}`; }
            }
            await sql`DELETE FROM hostel_students WHERE id=${id}`;
            return res.json({ success:true });
          }
        }

        if (section === 'fees') {
          if (req.method === 'GET') {
            const r = month
              ? await sql`SELECT * FROM hostel_fee_payments WHERE month=${month} ORDER BY created_at DESC`
              : await sql`SELECT * FROM hostel_fee_payments ORDER BY created_at DESC LIMIT 300`;
            return res.json(r);
          }
          if (req.method === 'POST') {
            const { studentName,month:m,amount,mode } = req.body||{};
            if (!studentName||!amount) return res.status(400).json({ error:'studentName and amount required' });
            const r = await sql`INSERT INTO hostel_fee_payments (student_name,month,amount,mode) VALUES (${studentName},${m||new Date().toISOString().slice(0,7)},${+amount},${mode||'Cash'}) RETURNING *`;
            return res.status(201).json(r[0]);
          }
        }
        break;
      }

      // ════════════ OVERVIEW ════════════
      case 'overview': {
        const user = requireAuth(req, res); if (!user) return;
        const [students,teachers,fees,accounts,income,expenses,buses,rooms,hostel] = await Promise.all([
          sql`SELECT unit, COUNT(*) as count FROM students GROUP BY unit`,
          sql`SELECT unit, COUNT(*) as count, SUM(salary) as total_salary FROM teachers GROUP BY unit`,
          sql`SELECT unit, SUM(amount) as total FROM fee_payments GROUP BY unit`,
          sql`SELECT unit, SUM(balance) as balance FROM accounts GROUP BY unit`,
          sql`SELECT unit, SUM(amount) as total FROM income GROUP BY unit`,
          sql`SELECT unit, SUM(amount) as total FROM expenses GROUP BY unit`,
          sql`SELECT COUNT(*) as count, SUM(students) as transported FROM buses`,
          sql`SELECT COUNT(*) as rooms, SUM(capacity) as capacity, SUM(occupied) as occupied FROM hostel_rooms`,
          sql`SELECT COUNT(*) as count, SUM(monthly_fee) as monthly_income FROM hostel_students`,
        ]);
        return res.json({ students, teachers, fees, accounts, income, expenses, buses:buses[0], rooms:rooms[0], hostel:hostel[0] });
      }

      default:
        return res.status(404).json({ error: `Unknown route: ${route}` });
    }
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
