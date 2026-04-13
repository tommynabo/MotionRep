export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0ZM12 4.5C12 8.64214 8.64214 12 4.5 12C8.64214 12 12 15.3579 12 19.5C12 15.3579 15.3579 12 19.5 12C15.3579 12 12 8.64214 12 4.5Z" />
    </svg>
  );
}
