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
  await supabaseClient.auth.signOut();
};


const checkUserLoginOrNot = async () => {
  const { data, error } = await supabaseClient.auth.getSession()
  return data.session;

};


const getCurrentUser = async () => {
  const { data: { user } } = await supabaseClient.auth.getUser()

  return user;

};


const createEmployeeDataInDatabase = async (employeeData) => {

  const { data: signUpData, error: signUpError } = await signUp(employeeData.email, employeeData.password);
  if (signUpError) {
    throw signUpError;
  }
  const newUser = signUpData?.user;
  if (!newUser) {
    throw new Error("User could not be created.");
  }
  employeeData.userId = newUser.id;

  await supabaseClient
    .from('EmployeeData')
    .insert({ employeeData });

  const getData = await getEmployeeDataFromDatabase();

  return getData;

}


const getEmployeeDataFromDatabase = async () => {
  const { data } = await supabaseClient
    .from('EmployeeData')
    .select()


  return data;

};




// Deletes employee: removes EmployeeData row by id only (no auth.admin — use backend/Dashboard to remove Auth user if needed).
const deleteDataFromDatabase = async (tableRowId) => {
  const { error } = await supabaseClient
    .from('EmployeeData')
    .delete()
    .eq('id', tableRowId);
  await getEmployeeDataFromDatabase();
  return error;
};

// Updates employee row. Caller must pass full employeeData (e.g. merged with existing dailyUpdates).
const editEmployeeFromDatabase = async (employeeData, tableRowId) => {
  const { data, error } = await supabaseClient
    .from('EmployeeData')
    .update({ employeeData })
    .eq('id', tableRowId)
    .select();
  console.log('editEmployeeFromDatabase response:', { data, error });
  if (error) throw error;
  const allData = await getEmployeeDataFromDatabase();
  return allData;
};

const updateProfileData = async (userName, image, employeeId) => {
  let fileData = null;
  let errors = null;

  if (image) {

    const { data, error } = await supabaseClient
      .storage
      .from('images')
      .upload(`${Date.now()}-${image.name}`, image, {
        cacheControl: "3600",
        upsert: false,
      })

    errors = error;
    fileData = data;
  }

  const currentEmployee = await getEmployeeDataFromDatabase();

  const findEmployee = currentEmployee.find((data) => data.id === employeeId);
  if (!findEmployee || !findEmployee.employeeData) {
    throw new Error('Employee not found.');
  }

  if (image) {
    findEmployee.employeeData.profilePicture = fileData.fullPath;
  }

  findEmployee.employeeData.fullName = userName;

  await editEmployeeFromDatabase(findEmployee.employeeData, employeeId);

  return { findEmployee, errors };



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
  supabaseUrl
}

