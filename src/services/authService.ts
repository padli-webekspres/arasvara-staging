import { connectToDatabase } from "@/lib/db/db";
import bcrypt from "bcryptjs"; 
import { ObjectId } from "mongodb";

export async function loginUser(email: string, password: string) {
  const database = await connectToDatabase();
  
  // 1. Cari user berdasarkan email
  const user = await database.collection("users").findOne({ email });
  
  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // 2. Cek status aktif
  if (!user.isActive) {
    throw new Error("ACCOUNT_DEACTIVATED");
  }

  // 3. Bandingkan password
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // 4. Pisahkan password dari data user
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export async function changePassword(
  userId: string,
  oldPassword: string | null,
  newPassword: string,
  bypassOldPasswordCheck: boolean = false
) {
  const database = await connectToDatabase();
  
  if (!ObjectId.isValid(userId)) {
    throw new Error("INVALID_USER_ID");
  }

  // 1. Cari user berdasarkan ID
  const user = await database.collection("users").findOne({ _id: new ObjectId(userId) });
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  // 2. Bandingkan password lama jika tidak di-bypass
  if (!bypassOldPasswordCheck) {
    if (!oldPassword) {
      throw new Error("Password lama harus diisi");
    }
    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      throw new Error("INCORRECT_OLD_PASSWORD");
    }
  }

  // 3. Hash password baru
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // 4. Perbarui di database
  await database.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    { $set: { password: hashedPassword, updatedAt: new Date().toISOString() } }
  );

  return { success: true, targetUser: user };
}