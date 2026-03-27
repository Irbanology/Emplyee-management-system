import { showSpinner } from "./utils.js";

// Create a single supabase client for interacting with your database
const supabaseUrl = 'https://dzsbtiebrkovqpjlzmbx.supabase.co'
const supabaseKey = 'sb_publishable_PkzwPreQe4_QcfhmSlojCw_TC7db-Qw';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey)


// SIGNUP FOR EMPLOYEES...
const signUp = async (email, password) => {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  return { data, error }

}


const loginAdminAndEmployee = async (email, password) => {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  })

  return { data, error }

};

const logout = async () => {
  try {
    await supabaseClient.auth.signOut();
  } catch (err) {
    console.error('logout:', err);
    throw new Error('Could not sign out. Please try again.');
  }
};


const checkUserLoginOrNot = async () => {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session ?? null;
  } catch (err) {
    console.error('checkUserLoginOrNot:', err);
    return null;
  }
};


const getCurrentUser = async () => {
  try {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    return data?.user ?? null;
  } catch (err) {
    console.error('getCurrentUser:', err);
    return null;
  }
};


const createEmployeeDataInDatabase = async (employeeData) => {
  try {
    const { data: signUpData, error: signUpError } = await signUp(employeeData.email, employeeData.password);
    if (signUpError) throw signUpError;
    const newUser = signUpData?.user;
    if (!newUser) throw new Error('User could not be created.');
    employeeData.userId = newUser.id;

    const { error: insertError } = await supabaseClient
      .from('EmployeeData')
      .insert({ employeeData });
    if (insertError) throw insertError;

    return await getEmployeeDataFromDatabase();
  } catch (err) {
    const msg = err?.message ?? err?.error_description ?? '';
    if (msg.includes('already registered') || msg.includes('already exists')) {
      throw new Error('This email is already registered.');
    }
    throw err;
  }
};


const getEmployeeDataFromDatabase = async () => {
  try {
    const { data, error } = await supabaseClient
      .from('EmployeeData')
      .select();
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('getEmployeeDataFromDatabase:', err);
    throw new Error(err?.message ?? 'Could not load data. Check your connection.');
  }
};

function normalizeUpdateStatus(rawStatus, hasComments = false) {
  const raw = String(rawStatus || '').trim().toLowerCase();
  if (raw === 'submitted' || raw === 'received' || raw === 'replied' || raw === 'completed') return raw;
  if (raw === 'reviewed') return hasComments ? 'replied' : 'received';
  return 'submitted';
}




// Deletes employee: removes EmployeeData row by id only (no auth.admin — use backend/Dashboard to remove Auth user if needed).
const deleteDataFromDatabase = async (tableRowId) => {
  try {
    const { error } = await supabaseClient
      .from('EmployeeData')
      .delete()
      .eq('id', tableRowId);
    if (error) return error;
    return null;
  } catch (err) {
    console.error('deleteDataFromDatabase:', err);
    return err instanceof Error ? err : new Error('Could not delete employee.');
  }
};

// Updates employee row. Caller must pass full employeeData (e.g. merged with existing dailyUpdates).
const editEmployeeFromDatabase = async (employeeData, tableRowId) => {
  try {
    const { error } = await supabaseClient
      .from('EmployeeData')
      .update({ employeeData })
      .eq('id', tableRowId)
      .select();
    if (error) throw error;
    return await getEmployeeDataFromDatabase();
  } catch (err) {
    console.error('editEmployeeFromDatabase:', err);
    throw new Error(err?.message ?? 'Could not save changes. Please try again.');
  }
};

const updateProfileData = async (userName, image, employeeId) => {
  let fileData = null;
  let uploadError = null;

  if (image) {
    try {
      const { data, error } = await supabaseClient.storage
        .from('images')
        .upload(`${Date.now()}-${image.name}`, image, { cacheControl: '3600', upsert: false });
      uploadError = error;
      fileData = data;
    } catch (err) {
      console.error('Profile image upload:', err);
      uploadError = err;
    }
  }

  const currentEmployee = await getEmployeeDataFromDatabase();
  const findEmployee = currentEmployee.find((d) => String(d.id) === String(employeeId));
  if (!findEmployee || !findEmployee.employeeData) {
    throw new Error('Employee not found.');
  }

  if (image && fileData?.fullPath) {
    findEmployee.employeeData.profilePicture = fileData.fullPath;
  }

  findEmployee.employeeData.fullName = userName;

  await editEmployeeFromDatabase(findEmployee.employeeData, employeeId);
  return { findEmployee, errors: uploadError };
};

// Guarded update edit: employee can edit only while status is "submitted".
const editEmployeeUpdateIfSubmitted = async ({ tableRowId, updateId, updateText }) => {
  const safeText = String(updateText ?? '').trim();
  if (!safeText) throw new Error('Update text cannot be empty.');

  const { data, error } = await supabaseClient
    .from('EmployeeData')
    .select()
    .eq('id', tableRowId)
    .single();
  if (error) throw error;
  if (!data?.employeeData) throw new Error('Employee record not found.');

  const dailyUpdates = Array.isArray(data.employeeData.dailyUpdates) ? data.employeeData.dailyUpdates : [];
  let found = false;
  let changed = false;

  const updatedDailyUpdates = dailyUpdates.map((u) => {
    if (String(u?.updateId) !== String(updateId)) return u;
    found = true;
    const comments = Array.isArray(u?.adminComments) ? u.adminComments : [];
    const status = normalizeUpdateStatus(u?.status, comments.length > 0);
    if (status !== 'submitted') {
      throw new Error('This update can no longer be edited after it has been reviewed.');
    }
    changed = true;
    return {
      ...u,
      status,
      updateText: safeText,
      updatedAt: Date.now(),
    };
  });

  if (!found) throw new Error('Update record not found.');
  if (!changed) return data;

  const nextEmployeeData = {
    ...data.employeeData,
    dailyUpdates: updatedDailyUpdates,
  };

  const { error: updateError } = await supabaseClient
    .from('EmployeeData')
    .update({ employeeData: nextEmployeeData })
    .eq('id', tableRowId);
  if (updateError) throw updateError;

  return { ...data, employeeData: nextEmployeeData };
};



export {
  createEmployeeDataInDatabase,
  getEmployeeDataFromDatabase,
  deleteDataFromDatabase,
  editEmployeeFromDatabase,
  loginAdminAndEmployee,
  checkUserLoginOrNot,
  getCurrentUser,
  logout,
  updateProfileData,
  editEmployeeUpdateIfSubmitted,
  supabaseUrl
}

