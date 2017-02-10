#!/bin/bash
OUT_DIR="${PWD}/tmp/out"
STORE_DIR="${PWD}/out"
CROSS_CHAIN=++CROSS_CHAIN++
# /opt/abcross/armel/bin/armv7a-aosc-linux-gnueabihf-

echo "Downloading Linux kernel source..."
wget ++LINUX_SRC++
echo "Downloading U-Boot source..."
wget ++UBOOT_SRC++
LINUX_SRC="$(echo linux-*.tar*)"
UBOOT_SRC="$(echo u-boot-*.tar*)"
LINUX_DIR="$(echo $LINUX_SRC | sed 's/\.tar\..*//g')"
git clone https://github.com/AOSC-Dev/aosc-os-armel-sunxi-boot
echo "Building u-boot..."

mkdir -p "$OUT_DIR"

pushd "aosc-os-armel-sunxi-boot"
ln -s ../${UBOOT_SRC} .
ln -s ../${LINUX_SRC} .
chmod a+x ./list.sh
. ./list.sh
[ "$BUILD_UBOOT" != "0" ] &&
for i in $UBOOT_TARGETS
do
	UBOOT_CNAME="$(echo $i | cut -d = -f 1)"
	UBOOT_AOSCNAME="$(echo $i | cut -d = -f 2)"
	echo "Building u-boot for device $UBOOT_AOSCNAME..."
	tar xf "$UBOOT_SRC"
	UBOOT_DIR="$(echo u-boot-*/)"
	pushd "$UBOOT_DIR"
	for j in ../patches/u-boot/*
	do
		echo " -- Patching with ${j}"
		patch -Np1 -s -i "${j}" >> patch.log
	done
	mkdir -p "$LOG_DIR"/u-boot-"$UBOOT_AOSCNAME"
	make "${UBOOT_CNAME}"_defconfig 2>&1
	echo "Configured"
	make CROSS_COMPILE="${CROSS_CHAIN}" -j$(nproc) 2>&1
	echo "Built"
	mkdir -p "$OUT_DIR"/u-boot-"$UBOOT_AOSCNAME"/
	cp u-boot-sunxi-with-spl.bin "$OUT_DIR"/u-boot-"$UBOOT_AOSCNAME"/
	echo "Copied"
	popd
	rm -r "$UBOOT_DIR"
done

echo "Building linux..."

if [ "$BUILD_LINUX" != "0" ]; then
	echo "Building linux for KVM-disabled sunxi CPUs..."
	if [ ! -d "$LINUX_DIR" ]; then
		tar xf "$LINUX_SRC"
		pushd "$LINUX_DIR"
		for i in ../patches/linux/*
		do
			echo " -- Patching with ${i}"
			patch -Np1 -s -i $i >> patch.log
		done
	else
		pushd "$LINUX_DIR"
	fi
	mkdir -p "$LOG_DIR"/linux-sunxi-nokvm
	cp ../sunxi-nokvm-config .config
	echo "Configured"
	# FIXME: hard coded parallel.
	make ARCH=arm CROSS_COMPILE="${CROSS_CHAIN}" -j"$(nproc)" 2>&1
	echo "Built"
	TMPDIR=$(mktemp -d)
	make ARCH=arm CROSS_COMPILE="${CROSS_CHAIN}" INSTALL_MOD_PATH="$TMPDIR" modules_install 2>&1
	mkdir -p "$OUT_DIR"/linux-sunxi-nokvm
	cp -- arch/arm/boot/zImage "$OUT_DIR"/linux-sunxi-nokvm/
	EXTRA_KMOD_DIR="$(echo "$TMPDIR"/lib/modules/*)/kernel/extra"
	mkdir -p "$EXTRA_KMOD_DIR"
	for i in ../extra-kmod/*
	do
		export KDIR=$PWD ARCH=arm CROSS_COMPILE="${CROSS_CHAIN}"
		pushd $i
		sh build.sh 2>&1
		cp -- *.ko "$EXTRA_KMOD_DIR/"
		popd
		unset KDIR
	done
	depmod -b "$TMPDIR" "$(basename $(readlink -f $EXTRA_KMOD_DIR/../..))"
	echo "Extra modules built"
	cp -r -- "$TMPDIR"/lib/modules/ "$OUT_DIR"/linux-sunxi-nokvm/
	rm -r -- "$TMPDIR"
	echo "Copied"
	echo "Building linux for KVM-enabled sunxi CPUs..."
	mkdir -p "$LOG_DIR"/linux-sunxi-kvm
	cp ../sunxi-kvm-config .config
	echo "Configured"
	make ARCH=arm CROSS_COMPILE="${CROSS_CHAIN}" -j"$(nproc)" 2>&1
	echo "Built"
	TMPDIR=$(mktemp -d)
	make ARCH=arm CROSS_COMPILE="${CROSS_CHAIN}" INSTALL_MOD_PATH="$TMPDIR" modules_install 2>&1
	mkdir -p "$OUT_DIR"/linux-sunxi-kvm
	cp arch/arm/boot/zImage "$OUT_DIR"/linux-sunxi-kvm/
	EXTRA_KMOD_DIR="$(echo "$TMPDIR"/lib/modules/*)/kernel/extra"
	mkdir -p "$EXTRA_KMOD_DIR"
	for i in ../extra-kmod/*
	do
		export KDIR=$PWD ARCH=arm CROSS_COMPILE="${CROSS_CHAIN}"
		pushd "${i}"
		sh build.sh 2>&1
		cp -- *.ko "$EXTRA_KMOD_DIR/"
		popd
		unset KDIR
	done
	depmod -b "$TMPDIR" "$(basename $(readlink -f $EXTRA_KMOD_DIR/../..))"
	echo "Extra modules built"
	cp -r "$TMPDIR"/lib/modules/ "$OUT_DIR"/linux-sunxi-kvm/
	rm -r "$TMPDIR"
	echo "Copied"
	popd
fi

echo "Building DTBs..."

[ "$BUILD_DTB" != "0" ] &&
for i in $DTB_TARGETS
do
	DTB_CNAME="$(echo $i | cut -d = -f 1)"
	DTB_AOSCNAME="$(echo $i | cut -d = -f 2)"
	mkdir -p "$OUT_DIR"/dtb-"$DTB_AOSCNAME"
	cp "$LINUX_DIR"/arch/arm/boot/dts/"$DTB_CNAME".dtb "$OUT_DIR"/dtb-"$DTB_AOSCNAME"/dtb.dtb
	echo "Copied dtb for $DTB_AOSCNAME"
done
GIT_REV=$(git rev-parse --short HEAD)
popd && popd
FILE_COUNT=$(ls ${OUT_DIR} | wc -l)
if [[ $((FILE_COUNT)) -lt 76 ]]; then
	echo "No enough files collected, suspecting a build failure!"
	exit 127
fi
echo "Tarring final tarball..."
TARBALL_NAME="aosc-os-armel-sunxi-boot-$(date +%Y%m%d)-g${GIT_REV}-$(basename ${LINUX_DIR})-$(basename ${UBOOT_DIR})"
mkdir "${STORE_DIR}"
tar cJf ${STORE_DIR}/"${TARBALL_NAME}.tar.xz" "${OUT_DIR}/*"
FILE_SIZE=$(stat -c "%s" "${STORE_DIR}/${TARBALL_NAME}.tar.xz")
if [[ $((FILE_SIZE)) -lt 20000000 ]]; then
	echo "Resulting file too small (only ${FILE_SIZE} bytes), suspecting a build failure!"
	rm -- "${TARBALL_NAME}.tar.xz"
	exit 127
fi
echo "[+] Product: ${TARBALL_NAME}.tar.xz"
echo "[+] Size:    ${FILE_SIZE} bytes"
