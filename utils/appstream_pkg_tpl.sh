#!/bin/bash
PKGDIR="$(realpath "$(mktemp -d -p .)")"
git clone --depth 2 "https://github.com/AOSC-Dev/aosc-appstream-data.git" aosc-appstream-data
pushd -- aosc-appstream-data || exit 127

mkdir -p "$PKGDIR"/usr/share/app-info/
cp -r {xmls,icons} "$PKGDIR"/usr/share/app-info/
rm "$PKGDIR"/usr/share/app-info/xmls/appstream-ignore.xml

PKGSIZE="$(du -s "$PKGDIR" | cut -f1 -d$'\t')"
mkdir "$PKGDIR"/DEBIAN
cat << EOF > "$PKGDIR"/DEBIAN/control
Package: aosc-appstream-data
Version: $(date +%Y%m%d)
Architecture: all
Section: misc
Maintainer: Jeff Bai <jeffbai@aosc.xyz>
Installed-Size: ${PKGSIZE}
Description: AOSC package database for AppStream (FD.o) frontends
Depends:

EOF

popd
dpkg-deb -b "${PKGDIR}"
mv ./*.deb "/workspace/out/aosc-appstream-data_$(date +%Y%m%d)-0_noarch.deb"
