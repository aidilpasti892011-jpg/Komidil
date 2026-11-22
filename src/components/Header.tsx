import Logo from "./Logo";
import HeaderActions from "./HeaderActions";
import NavLinks from "./NavLinks";

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-[calc(56px+env(safe-area-inset-top))] items-center justify-between border-b border-line bg-bg/90 px-3.5 pt-[env(safe-area-inset-top)] backdrop-blur">
      <Logo />
      <div className="flex items-center gap-1.5">
        <NavLinks variant="top" />
        <HeaderActions />
      </div>
    </header>
  );
}
