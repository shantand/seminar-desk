import RegistrationForm from './registration-form';
export const dynamic='force-dynamic';
export default async function RegistrationPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <RegistrationForm id={id}/>;}
